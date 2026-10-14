import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Card, Btn, Icon } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

// ═══════════════════════════════════════════════════════════════════
//  CLASS CALL ROOM — real WebRTC audio/video for a whole class at once
//  (one room per TeacherAssignment, the same "whole class" scope as
//  GroupChatBox), not a 1:1 call. Mesh topology: this browser opens one
//  RTCPeerConnection directly to every other participant — media never
//  passes through the server, only signaling (SDP/ICE) does, relayed by
//  backend/src/socket/callSocket.js. Reasonable for a single classroom's
//  worth of participants; a mesh doesn't scale to hundreds, which is fine
//  here since a "class" is bounded by its real roster size.
//
//  Also handles screen sharing (RTCRtpSender.replaceTrack — no
//  renegotiation needed), a fullscreen presentation mode, and a lightweight
//  Web-Audio-based "who's talking" indicator.
// ═══════════════════════════════════════════════════════════════════

const ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
const SCREEN_SHARE_SUPPORTED = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
// Time-domain RMS (loudness), not a frequency-spectrum average — a voice
// (or any other real signal) concentrates its energy in a handful of the
// analyser's 256 frequency bins, so averaging across the whole spectrum
// reads as near-silent even at full volume. RMS of the raw waveform is the
// standard, robust way to measure "is there real signal here" regardless
// of its frequency content. 0.02 sits well above typical mic noise floor
// but comfortably below actual speech.
const SPEAKING_RMS_THRESHOLD = 0.02;

function resolveSocketUrl() {
  const envUrl = import.meta.env?.VITE_SOCKET_URL;
  if (envUrl) return envUrl;
  if (typeof window === "undefined") return "http://localhost:5001";
  // Dev server — same host the page was loaded from (localhost, 127.0.0.1,
  // or a LAN IP when testing from another device), backend's own port.
  if (import.meta.env.DEV) return `${window.location.protocol}//${window.location.hostname}:5001`;
  return window.location.origin;
}

function fmtDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// A ref CALLBACK (not useRef+useEffect) so srcObject is (re)attached every
// single time this exact DOM node is created — including when React
// unmounts/remounts the <video> element because `video` flipped off then
// back on (the tile swaps to an avatar placeholder and back, a different
// element type each time, so a dependency-array effect on `stream` alone
// would silently never re-fire for a freshly created node whose `stream`
// prop happens to be unchanged. That was the actual bug: turning the
// camera back on left every subsequent tile permanently blank).
//
// Memoized with useCallback keyed on `stream` (plus the srcObject !== stream
// guard) so the callback's identity — not just its behavior — only changes
// when the stream actually does. An inline arrow function here would get a
// new identity on every render of this component, and React detaches +
// reattaches a ref whenever its function identity changes, not only on
// real mount/unmount. Tile re-renders very often (the parent's 1s duration
// tick, the speaking-indicator animation loop, any peer media-state update),
// so an unmemoized callback was reassigning srcObject on an already-playing
// video many times a second — the actual cause of the reported flicker, and
// on some browsers/devices frequent enough that a frame never stabilizes
// long enough to render at all (looks like "video not displaying").
function Tile({ stream, name, isLocal, audio, video, muted, speaking, spotlight, screenSharing }) {
  const setVideoRef = useCallback((el) => {
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  return (
    <div
      style={{
        position: "relative", borderRadius: spotlight ? 16 : 14, overflow: "hidden", background: "#14181f",
        aspectRatio: spotlight ? "16/9" : "4/3", width: "100%", height: "100%",
        outline: speaking ? "3px solid var(--success)" : "3px solid transparent",
        transition: "outline-color .15s ease",
        boxShadow: speaking ? "0 0 0 1px var(--success), 0 0 18px -4px var(--success)" : "none",
      }}
    >
      {stream && video ? (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={muted}
          style={{ width: "100%", height: "100%", objectFit: screenSharing ? "contain" : "cover", background: "#000", transform: isLocal && !screenSharing ? "scaleX(-1)" : "none" }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: spotlight ? 84 : 56, height: spotlight ? 84 : 56, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: spotlight ? 30 : 20 }}>
            {(name || "?").slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: 8, bottom: 8, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.55)", padding: "4px 9px", borderRadius: 99 }}>
        {!audio && <span style={{ color: "var(--danger)", display: "flex" }}><Icon name="micOff" size={11} /></span>}
        {screenSharing && <span style={{ color: "var(--info)", display: "flex" }}><Icon name="video" size={11} /></span>}
        <span style={{ fontSize: 11.5, color: "#fff", fontWeight: 600 }}>{name}{isLocal ? " (You)" : ""}{screenSharing ? " — presenting" : ""}</span>
      </div>
    </div>
  );
}

export default function ClassCallRoom({ teacherAssignmentId, subtitle }) {
  const { session } = useSession();
  const toast = useToast();

  const [status, setStatus] = useState("idle"); // idle | requesting-media | connecting | in-call | error
  const [errorMsg, setErrorMsg] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState([]); // [{socketId, name, role, audio, video, screenSharing, stream}]
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [speakingIds, setSpeakingIds] = useState(() => new Set());
  const [elapsed, setElapsed] = useState(0);

  const socketRef = useRef(null);
  const cameraStreamRef = useRef(null); // camera+mic, kept alive even while screen-sharing
  const screenStreamRef = useRef(null);
  const pcsRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const pendingCandidatesRef = useRef(new Map()); // socketId -> candidate[]
  const mountedRef = useRef(true);
  const containerRef = useRef(null);
  const callStartRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analysersRef = useRef(new Map()); // id -> { analyser, dataArray }
  // The "disconnect" socket listener closes over whatever `status` was at
  // registration time — a stale value, not the live one — so it can't just
  // check `status !== "idle"` to tell an intentional leaveCall() apart from
  // a real drop. This ref is the actual source of truth for that instead.
  const intentionalLeaveRef = useRef(false);

  const updatePeer = useCallback((socketId, patch) => {
    setPeers(prev => prev.map(p => (p.socketId === socketId ? { ...p, ...patch } : p)));
  }, []);

  const closePeer = useCallback((socketId) => {
    pcsRef.current.get(socketId)?.close();
    pcsRef.current.delete(socketId);
    pendingCandidatesRef.current.delete(socketId);
    analysersRef.current.delete(socketId);
    setPeers(prev => prev.filter(p => p.socketId !== socketId));
  }, []);

  const activeVideoTrack = useCallback(() => {
    if (screenStreamRef.current) return screenStreamRef.current.getVideoTracks()[0] || null;
    return cameraStreamRef.current?.getVideoTracks()[0] || null;
  }, []);

  const createPeerConnection = useCallback((socketId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const micTrack = cameraStreamRef.current?.getAudioTracks()[0];
    if (micTrack) pc.addTrack(micTrack, cameraStreamRef.current);
    const videoTrack = activeVideoTrack();
    if (videoTrack) pc.addTrack(videoTrack, screenStreamRef.current || cameraStreamRef.current);

    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit("ice-candidate", { to: socketId, candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      updatePeer(socketId, { stream: e.streams[0] });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) closePeer(socketId);
    };

    pcsRef.current.set(socketId, pc);
    return pc;
  }, [updatePeer, closePeer, activeVideoTrack]);

  const applyPendingCandidates = useCallback(async (socketId, pc) => {
    const queued = pendingCandidatesRef.current.get(socketId);
    if (!queued?.length) return;
    for (const candidate of queued) {
      try { await pc.addIceCandidate(candidate); } catch { /* ignore stale candidates */ }
    }
    pendingCandidatesRef.current.delete(socketId);
  }, []);

  const leaveCall = useCallback(() => {
    intentionalLeaveRef.current = true;
    socketRef.current?.emit("leave-room");
    socketRef.current?.disconnect();
    socketRef.current = null;
    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    pendingCandidatesRef.current.clear();
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    analysersRef.current.clear();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    callStartRef.current = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (mountedRef.current) {
      setLocalStream(null);
      setPeers([]);
      setStatus("idle");
      setScreenSharing(false);
      setElapsed(0);
      setSpeakingIds(new Set());
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      leaveCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherAssignmentId]);

  // ── Fullscreen ──────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen().catch(() => toast("Fullscreen isn't available here"));
  };

  // ── Call duration ────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "in-call") return;
    if (!callStartRef.current) callStartRef.current = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - callStartRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status]);

  // ── Speaking detection (Web Audio) ──────────────────────────────────
  // Lazily attaches an AnalyserNode to each tile's audio track the first
  // time we see it, then polls all of them on one shared rAF loop.
  useEffect(() => {
    if (status !== "in-call") return;
    const audioCtx = audioCtxRef.current; // created in joinCall(), inside the real click gesture
    if (!audioCtx) return;
    const currentIds = new Set(["local", ...peers.map(p => p.socketId)]);
    const tiles = [{ id: "local", stream: localStream }, ...peers.map(p => ({ id: p.socketId, stream: p.stream }))];

    tiles.forEach(({ id, stream }) => {
      if (analysersRef.current.has(id)) return;
      if (!stream || stream.getAudioTracks().length === 0) return;
      try {
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        // Time-domain buffer (fftSize long), not frequencyBinCount — see
        // the SPEAKING_RMS_THRESHOLD comment for why.
        analysersRef.current.set(id, { analyser, dataArray: new Uint8Array(analyser.fftSize) });
      } catch { /* track not ready yet — will retry on next peers/localStream change */ }
    });
    for (const id of [...analysersRef.current.keys()]) {
      if (!currentIds.has(id)) analysersRef.current.delete(id);
    }
  }, [status, localStream, peers]);

  useEffect(() => {
    if (status !== "in-call") return;
    let raf;
    const tick = () => {
      const speaking = new Set();
      analysersRef.current.forEach(({ analyser, dataArray }, id) => {
        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        if (rms > SPEAKING_RMS_THRESHOLD) speaking.add(id);
      });
      setSpeakingIds(prev => {
        if (prev.size === speaking.size && [...prev].every(id => speaking.has(id))) return prev;
        return speaking;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const joinCall = async () => {
    intentionalLeaveRef.current = false;
    setErrorMsg("");
    setStatus("requesting-media");
    // Created here (synchronously, at the top of a real onClick handler),
    // not in the speaking-detection useEffect below — an AudioContext
    // created outside a genuine user-gesture call stack starts (and stays)
    // "suspended" under the browser's autoplay policy, silently producing
    // all-zero analyser data forever. Creating it here, and explicitly
    // resuming it, is what actually makes the speaking indicator work.
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtxRef.current = new Ctx();
    }
    audioCtxRef.current?.resume().catch(() => {});
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      try {
        // Camera might be unavailable/denied while mic still works — a
        // real, common case (no webcam on a desktop) worth degrading to
        // rather than failing the whole call outright.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        toast("No camera found — joining with audio only");
        setCamOn(false);
      } catch (e2) {
        setStatus("error");
        setErrorMsg("Camera/microphone access is required to join the call, and it was denied or unavailable.");
        return;
      }
    }
    if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
    cameraStreamRef.current = stream;
    setLocalStream(stream);
    setStatus("connecting");

    const socket = io(resolveSocketUrl(), {
      path: "/socket.io-calls/",
      auth: { token: session.token },
      reconnection: false,
      timeout: 8000,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.error("[call] connect_error:", err.message);
      if (mountedRef.current) { setStatus("error"); setErrorMsg("Couldn't reach the call server. Please try again."); }
    });

    socket.on("connect", () => {
      socket.emit("join-room", { teacherAssignmentId }, async (ack) => {
        if (!ack?.ok) {
          if (mountedRef.current) { setStatus("error"); setErrorMsg(ack?.error || "Couldn't join the call."); }
          socket.disconnect();
          return;
        }
        if (!mountedRef.current) return;
        setPeers(ack.participants.map(p => ({ ...p, stream: null })));
        setStatus("in-call");

        // We're the new joiner — we offer to everyone already present.
        for (const p of ack.participants) {
          const pc = createPeerConnection(p.socketId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", { to: p.socketId, sdp: offer });
        }
      });
    });

    socket.on("peer-joined", (p) => {
      if (mountedRef.current) setPeers(prev => [...prev, { ...p, stream: null }]);
    });

    socket.on("offer", async ({ from, sdp }) => {
      const pc = pcsRef.current.get(from) || createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await applyPendingCandidates(from, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, sdp: answer });
    });

    socket.on("answer", async ({ from, sdp }) => {
      const pc = pcsRef.current.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await applyPendingCandidates(from, pc);
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = pcsRef.current.get(from);
      if (!pc || !pc.remoteDescription) {
        const q = pendingCandidatesRef.current.get(from) || [];
        q.push(candidate);
        pendingCandidatesRef.current.set(from, q);
        return;
      }
      try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
    });

    socket.on("peer-media-state", ({ socketId, audio, video, screenSharing: peerSharing }) => {
      updatePeer(socketId, { audio, video, screenSharing: peerSharing });
    });

    socket.on("peer-left", ({ socketId }) => closePeer(socketId));
    socket.on("disconnect", () => {
      if (mountedRef.current && !intentionalLeaveRef.current) { setStatus("error"); setErrorMsg("Disconnected from the call."); }
    });
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    cameraStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
    socketRef.current?.emit("media-state", { audio: next, video: camOn, screenSharing });
  };
  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    cameraStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next; });
    socketRef.current?.emit("media-state", { audio: micOn, video: next, screenSharing });
  };

  const startScreenShare = async () => {
    if (!SCREEN_SHARE_SUPPORTED) return;
    let screenStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch {
      return; // user cancelled the picker — not an error state
    }
    if (!mountedRef.current) { screenStream.getTracks().forEach(t => t.stop()); return; }
    const screenTrack = screenStream.getVideoTracks()[0];
    screenStreamRef.current = screenStream;

    pcsRef.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
      sender?.replaceTrack(screenTrack);
    });

    // Fires when the user clicks the browser/OS's own "Stop sharing" UI,
    // not just our in-app button — same cleanup path either way.
    screenTrack.onended = () => stopScreenShare();

    setScreenSharing(true);
    setLocalStream(screenStream);
    socketRef.current?.emit("media-state", { audio: micOn, video: camOn, screenSharing: true });
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0] || null;
    pcsRef.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
      sender?.replaceTrack(cameraTrack);
    });
    if (mountedRef.current) {
      setScreenSharing(false);
      setLocalStream(cameraStreamRef.current);
    }
    socketRef.current?.emit("media-state", { audio: micOn, video: camOn, screenSharing: false });
  };
  const toggleScreenShare = () => (screenSharing ? stopScreenShare() : startScreenShare());

  if (status === "idle" || status === "requesting-media") {
    return (
      <Card style={{ padding: 44, textAlign: "center" }}>
        <Icon name="video" size={26} style={{ opacity: 0.4, marginBottom: 10 }} />
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Class Call</div>
        {subtitle && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 18 }}>{subtitle}</div>}
        <Btn variant="accent" onClick={joinCall} disabled={status === "requesting-media"}>
          <Icon name="video" size={14} />{status === "requesting-media" ? "Requesting camera/mic…" : "Join Call"}
        </Btn>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card style={{ padding: 44, textAlign: "center" }}>
        <Icon name="videoOff" size={26} style={{ color: "var(--danger)", marginBottom: 10 }} />
        <div style={{ fontSize: 13.5, color: "var(--danger)", marginBottom: 18 }}>{errorMsg}</div>
        <Btn variant="accent" onClick={joinCall}><Icon name="video" size={14} />Try Again</Btn>
      </Card>
    );
  }

  const allTiles = [
    { socketId: "local", name: "You", isLocal: true, stream: localStream, audio: micOn, video: camOn, screenSharing },
    ...peers.map(p => ({ ...p, isLocal: false })),
  ];
  const spotlightTile = allTiles.find(t => t.screenSharing) || null;
  const gridTiles = spotlightTile ? allTiles.filter(t => t.socketId !== spotlightTile.socketId) : allTiles;

  return (
    <Card
      ref={containerRef}
      style={{
        padding: isFullscreen ? 20 : 18,
        background: isFullscreen ? "#0b0e14" : undefined,
        display: "flex", flexDirection: "column",
        height: isFullscreen ? "100vh" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: isFullscreen ? "#fff" : "var(--ink)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: status === "connecting" ? "var(--warn)" : "var(--success)" }} />
          {status === "connecting" ? "Connecting…" : `In call · ${allTiles.length} ${allTiles.length === 1 ? "participant" : "participants"}`}
          {status === "in-call" && <span style={{ color: "var(--muted)", fontWeight: 600 }}>· {fmtDuration(elapsed)}</span>}
        </div>
        <button className="icon-btn" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} style={{ width: 34, height: 34 }}>
          <Icon name={isFullscreen ? "x" : "video"} size={15} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {spotlightTile && (
          <div style={{ width: "100%" }}>
            <Tile
              stream={spotlightTile.stream} name={spotlightTile.name} isLocal={spotlightTile.isLocal}
              audio={spotlightTile.audio} video={spotlightTile.video} muted={spotlightTile.isLocal}
              speaking={speakingIds.has(spotlightTile.socketId)} spotlight screenSharing
            />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: spotlightTile ? "repeat(auto-fill,minmax(140px,1fr))" : "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
          {gridTiles.map(t => (
            <Tile
              key={t.socketId} stream={t.stream} name={t.name} isLocal={t.isLocal}
              audio={t.audio} video={t.video} muted={t.isLocal}
              speaking={speakingIds.has(t.socketId)} screenSharing={t.screenSharing && !spotlightTile}
            />
          ))}
        </div>
      </div>

      {peers.length === 0 && status === "in-call" && (
        <div style={{ textAlign: "center", fontSize: 12.5, color: isFullscreen ? "#9aa4b8" : "var(--muted)", margin: "14px 0" }}>
          Waiting for others to join this class's call…
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 10, paddingTop: 16 }}>
        <button className="icon-btn" title={micOn ? "Mute" : "Unmute"} onClick={toggleMic} style={{ width: 46, height: 46, background: micOn ? "var(--surface)" : "var(--danger-soft)", color: micOn ? "var(--ink-soft)" : "var(--danger)" }}>
          <Icon name={micOn ? "mic" : "micOff"} size={18} />
        </button>
        <button className="icon-btn" title={camOn ? "Turn off camera" : "Turn on camera"} onClick={toggleCam} style={{ width: 46, height: 46, background: camOn ? "var(--surface)" : "var(--danger-soft)", color: camOn ? "var(--ink-soft)" : "var(--danger)" }}>
          <Icon name={camOn ? "video" : "videoOff"} size={18} />
        </button>
        {SCREEN_SHARE_SUPPORTED && (
          <button className="icon-btn" title={screenSharing ? "Stop presenting" : "Present your screen"} onClick={toggleScreenShare} style={{ width: 46, height: 46, background: screenSharing ? "var(--info-soft)" : "var(--surface)", color: screenSharing ? "var(--info)" : "var(--ink-soft)" }}>
            <Icon name="monitor" size={18} />
          </button>
        )}
        <button className="icon-btn" title="Leave call" onClick={leaveCall} style={{ width: 46, height: 46, background: "var(--danger)", color: "#fff" }}>
          <Icon name="phone" size={18} />
        </button>
      </div>
    </Card>
  );
}
