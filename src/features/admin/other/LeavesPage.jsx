import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Avatar, Badge, Btn, Icon, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { dateRange, fmt, statusMeta } from "../../../lib/utils.js";

const TABS = ["pending", "approved", "rejected"];

export default function LeavesPage() {
  const { api } = useSession();
  const toast = useToast();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    api.getLeaves().then(setLeaves).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [api]);

  const review = async (id, status) => {
    setBusy(id + status);
    try { const updated = await api.reviewLeave(id, status); setLeaves(p => p.map(l => l._id === id ? updated : l)); toast(`Leave ${status}`, "check"); }
    catch (e) { toast(e.message); }
    finally { setBusy(null); }
  };

  const filtered = leaves.filter(l => l.status === tab);

  return (
    <>
      <SectionHeader eyebrow="Other" title="Leave Requests" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        {TABS.map(s => <StatCard key={s} label={s[0].toUpperCase() + s.slice(1)} value={leaves.filter(l => l.status === s).length} icon="file" />)}
      </div>
      <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 12, padding: 4, width: "fit-content", marginBottom: 18 }}>
        {TABS.map(t => {
          const count = leaves.filter(l => l.status === t).length;
          return (
            <button key={t} onClick={() => setTab(t)} className="btn" style={{
              padding: "8px 18px",
              background: tab === t ? "var(--accent-soft)" : "transparent",
              color: tab === t ? "var(--accent-ink)" : "var(--muted)",
            }}>
              {t[0].toUpperCase() + t.slice(1)} {count > 0 && <Badge tone="neutral">{count}</Badge>}
            </button>
          );
        })}
      </div>
      {loading && <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>}
      {!loading && filtered.length === 0 && <Card style={{ padding: 32 }}><EmptyState icon="clipboard" title={`No ${tab} requests`} /></Card>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(l => {
          const st = l.studentId;
          const meta = statusMeta(l.status);
          const days = dateRange(l.from, l.to).length;
          return (
            <Card key={l._id} style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar name={st?.name || "?"} size={42} />
                  <div><div style={{ fontSize: 15, fontWeight: 700 }}>{st?.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Roll #{st?.rollNo}</div></div>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 9, marginBottom: 14 }}>
                {[["Type", l.type], ["From", fmt(l.from)], ["To", fmt(l.to)], ["Days", `${days}d`], ["Applied", fmt(l.appliedAt)]].map(([label, value]) => (
                  <div key={label} style={{ background: "var(--surface-alt)", borderRadius: 9, padding: "9px 12px" }}>
                    <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "var(--surface-alt)", borderRadius: 9, padding: "11px 13px", marginBottom: l.status === "pending" ? 14 : 0 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Reason</div>
                <div style={{ fontSize: 13, lineHeight: 1.55 }}>{l.reason}</div>
              </div>
              {l.status === "pending" && (
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn variant="accent" full disabled={!!busy} onClick={() => review(l._id, "approved")}><Icon name="check" size={13} />Approve</Btn>
                  <Btn variant="danger" full disabled={!!busy} onClick={() => review(l._id, "rejected")}><Icon name="x" size={13} />Reject</Btn>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
