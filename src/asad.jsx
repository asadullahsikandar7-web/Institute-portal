// ═══════════════════════════════════════════════════════
//  AttendanceApp.jsx  —  Full Real-Backend Version
//  Connects to: http://localhost:5000
//  Auth: JWT stored in localStorage
// ═══════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, CheckCircle, XCircle, Calendar, Download, Search,
  X, Award, UserCheck, ChevronRight, FileText, Clock,
  AlertCircle, LogOut, Send, Inbox, Shield, BookOpen,
  Home, PlusCircle, CalendarDays, Loader, ThumbsUp,
  ThumbsDown, RefreshCw, Trash2, WifiOff, Eye, EyeOff
} from "lucide-react";

// ── Base URL — change this if your server runs elsewhere ──
const BASE = "http://localhost:5000";

// ══════════════════════════════════════════════════════
//  API LAYER
// ══════════════════════════════════════════════════════
const api = {
  _token: () => localStorage.getItem("att_token"),

  _headers() {
    const h = { "Content-Type": "application/json" };
    const t = this._token();
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
  },

  async _req(method, path, body) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: this._headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      if (err.name === "TypeError") throw new Error("Cannot reach server. Is it running?");
      throw err;
    }
  },

  get:    (path)        => api._req("GET",    path),
  post:   (path, body)  => api._req("POST",   path, body),
  patch:  (path, body)  => api._req("PATCH",  path, body),
  delete: (path)        => api._req("DELETE", path),

  // Auth
  adminLogin:   (email, password) => api.post("/api/auth/admin-login", { email, password }),
  studentLogin: (rollNo, password)=> api.post("/api/auth/student-login", { rollNo, password }),

  // Students
  getStudents:   ()     => api.get("/api/students"),
  addStudent:    (body) => api.post("/api/students", body),
  deleteStudent: (id)   => api.delete(`/api/students/${id}`),

  // Attendance
  getAttendance:   (date)      => api.get(`/api/attendance?date=${date}`),
  getHistory:      (sid, days) => api.get(`/api/attendance/history/${sid}?days=${days||30}`),
  markAttendance:  (body)      => api.post("/api/attendance", body),

  // Leaves
  getLeaves:    ()        => api.get("/api/leaves"),
  applyLeave:   (body)    => api.post("/api/leaves", body),
  reviewLeave:  (id, status) => api.patch(`/api/leaves/${id}`, { status }),
  deleteLeave:  (id)      => api.delete(`/api/leaves/${id}`),
};

// ══════════════════════════════════════════════════════
//  DESIGN TOKENS
// ══════════════════════════════════════════════════════
const T = {
  bg:"#07080f", card:"rgba(255,255,255,0.03)", border:"rgba(255,255,255,0.07)",
  txt:"#eaeaf5", muted:"rgba(255,255,255,0.34)",
  accent:"#7c6fef", green:"#22c55e", red:"#f43f5e",
  amber:"#f59e0b", blue:"#38bdf8", leave:"#a78bfa",
};
const font = "'Sora','DM Sans',system-ui,sans-serif";

// ══════════════════════════════════════════════════════
//  TINY SHARED COMPONENTS
// ══════════════════════════════════════════════════════
const Avatar = ({ name, size=38, color=T.accent }) => (
  <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,
    background:`linear-gradient(135deg,${color}cc,${color}44)`,
    border:`2px solid ${color}33`,display:"flex",alignItems:"center",
    justifyContent:"center",fontWeight:700,fontSize:size*.34,color:"#fff",letterSpacing:.5,fontFamily:font}}>
    {name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
  </div>
);

const Badge = ({ label, color, small }) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:5,
    padding:small?"2px 9px":"4px 12px",borderRadius:20,
    fontSize:small?10:11,fontWeight:700,letterSpacing:.4,
    background:`${color}18`,color,border:`1px solid ${color}28`}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:color,flexShrink:0}}/>
    {label}
  </span>
);

const statusMeta = s => ({
  present: {label:"Present",  color:T.green },
  absent:  {label:"Absent",   color:T.red   },
  leave:   {label:"On Leave", color:T.leave },
  unmarked:{label:"Unmarked", color:T.muted },
  pending: {label:"Pending",  color:T.amber },
  approved:{label:"Approved", color:T.green },
  rejected:{label:"Rejected", color:T.red   },
})[s] || {label:s,color:T.muted};

const fmt      = d => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmtShort = d => new Date(d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const today    = () => new Date().toISOString().split("T")[0];
const dateRange= (from,to) => {
  const days=[],cur=new Date(from);
  while(cur<=new Date(to)){days.push(cur.toISOString().split("T")[0]);cur.setDate(cur.getDate()+1);}
  return days;
};

const Inp = ({style={},...p}) => (
  <input {...p} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${T.border}`,
    borderRadius:10,padding:"11px 14px",color:T.txt,fontFamily:font,fontSize:14,
    outline:"none",width:"100%",boxSizing:"border-box",...style}}/>
);
const Sel = ({children,style={},...p}) => (
  <select {...p} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${T.border}`,
    borderRadius:10,padding:"11px 14px",color:T.txt,fontFamily:font,fontSize:14,
    outline:"none",width:"100%",boxSizing:"border-box",...style}}>
    {children}
  </select>
);
const Btn = ({children,variant="primary",size="md",onClick,disabled,style={}}) => {
  const bg  = variant==="primary"?`linear-gradient(135deg,${T.accent},${T.accent}bb)`:variant==="danger"?"rgba(244,63,94,.12)":variant==="success"?"rgba(34,197,94,.12)":"rgba(255,255,255,.05)";
  const col = variant==="primary"?"#fff":variant==="danger"?T.red:variant==="success"?T.green:T.txt;
  const brd = variant==="primary"?"none":variant==="danger"?`1px solid ${T.red}33`:variant==="success"?`1px solid ${T.green}33`:`1px solid ${T.border}`;
  return (
    <motion.button whileHover={disabled?{}:{scale:1.03}} whileTap={disabled?{}:{scale:.96}} onClick={disabled?undefined:onClick}
      style={{background:bg,border:brd,color:col,borderRadius:10,
        padding:size==="sm"?"7px 13px":"10px 20px",cursor:disabled?"not-allowed":"pointer",
        fontSize:size==="sm"?12:14,fontWeight:700,fontFamily:font,
        display:"flex",alignItems:"center",gap:6,
        boxShadow:variant==="primary"?`0 4px 18px ${T.accent}30`:"none",
        whiteSpace:"nowrap",opacity:disabled?.5:1,...style}}>
      {children}
    </motion.button>
  );
};
const Card = ({children,style={}}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,...style}}>
    {children}
  </div>
);

// ── Error Toast ──
const Toast = ({msg,type="error",onClose}) => (
  <motion.div initial={{opacity:0,y:20,scale:.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:10}}
    style={{position:"fixed",bottom:24,right:24,zIndex:200,
      background:type==="error"?"rgba(244,63,94,.15)":"rgba(34,197,94,.15)",
      border:`1px solid ${type==="error"?T.red:T.green}44`,
      borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:10,
      backdropFilter:"blur(12px)",maxWidth:360,fontFamily:font}}>
    {type==="error"?<AlertCircle size={16} color={T.red}/>:<CheckCircle size={16} color={T.green}/>}
    <span style={{fontSize:13,color:T.txt,flex:1}}>{msg}</span>
    <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,padding:2}}><X size={14}/></button>
  </motion.div>
);

function useToast() {
  const [toast,setToast] = useState(null);
  const show = useCallback((msg,type="error")=>{
    setToast({msg,type,id:Date.now()});
    setTimeout(()=>setToast(null),4000);
  },[]);
  const el = toast && <Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>;
  return [el,show];
}

// ══════════════════════════════════════════════════════
//  CHARTS (same as before but use real data)
// ══════════════════════════════════════════════════════
const Donut = ({present,leave,total}) => {
  const pct=total?present/total:0,r=36,c=2*Math.PI*r;
  return (
    <svg width={90} height={90} viewBox="0 0 90 90">
      <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={10}/>
      <circle cx={45} cy={45} r={r} fill="none" stroke={T.leave} strokeWidth={10}
        strokeDasharray={`${c*(leave/total||0)} ${c}`} strokeLinecap="round"
        transform="rotate(-90 45 45)" style={{transition:"all 1s ease"}}/>
      <circle cx={45} cy={45} r={r} fill="none" stroke={T.green} strokeWidth={10}
        strokeDasharray={`${c*pct} ${c}`} strokeLinecap="round"
        transform={`rotate(${-90+(leave/total||0)*360} 45 45)`}
        style={{transition:"all 1s ease"}}/>
      <text x={45} y={50} textAnchor="middle" fill="#fff" fontSize={14} fontWeight={700} fontFamily={font}>
        {Math.round(pct*100)}%
      </text>
    </svg>
  );
};

const MiniBar = ({history}) => (
  <div style={{display:"flex",gap:3,alignItems:"flex-end",height:56}}>
    {history.map((d,i)=>{
      const col=d.status==="present"?T.green:d.status==="leave"?T.leave:d.status==="absent"?T.red:"rgba(255,255,255,.08)";
      const h=d.status==="present"?"100%":d.status==="leave"?"65%":d.status==="absent"?"22%":"10%";
      return <div key={i} title={`${d.date}: ${d.status}`}
        style={{flex:1,minWidth:4,borderRadius:3,height:h,background:col,transition:"height .5s cubic-bezier(.34,1.56,.64,1)"}}/>;
    })}
  </div>
);

// ══════════════════════════════════════════════════════
//  STUDENT DRAWER — fetches real history from API
// ══════════════════════════════════════════════════════
const StudentDrawer = ({student, onClose}) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    api.getHistory(student._id || student.id)
      .then(h=>setHistory(h))
      .catch(()=>setHistory([]))
      .finally(()=>setLoading(false));
  },[student._id || student.id]);

  const present = history.filter(d=>d.status==="present").length;
  const leave   = history.filter(d=>d.status==="leave").length;
  const absent  = history.filter(d=>d.status==="absent").length;
  const streak  = (()=>{ let s=0; for(let i=history.length-1;i>=0;i--){ if(history[i].status==="present")s++;else break;} return s;})();

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",backdropFilter:"blur(10px)",zIndex:100,display:"flex",justifyContent:"flex-end"}}
      onClick={onClose}>
      <motion.div initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}}
        transition={{type:"spring",stiffness:300,damping:30}} onClick={e=>e.stopPropagation()}
        style={{width:460,height:"100%",overflowY:"auto",background:"#080812",
          borderLeft:`1px solid ${T.border}`,padding:28,display:"flex",flexDirection:"column",gap:20,fontFamily:font}}>

        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <Avatar name={student.name} size={56} color={T.accent}/>
            <div>
              <div style={{fontSize:20,fontWeight:800,color:T.txt,marginBottom:2}}>{student.name}</div>
              <div style={{fontSize:12,color:T.muted}}>{student.email}</div>
              <div style={{fontSize:11,color:T.accent,marginTop:3,fontWeight:700,letterSpacing:1}}>ROLL #{student.rollNo}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.06)",border:"none",borderRadius:9,padding:8,cursor:"pointer",color:T.muted}}>
            <X size={16}/>
          </button>
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:"center",color:T.muted}}>
            <Loader size={24} style={{animation:"spin 1s linear infinite",margin:"0 auto 10px",display:"block"}} color={T.accent}/>
            Loading history…
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:9}}>
              {[{label:"Present",value:present,col:T.green},{label:"Absent",value:absent,col:T.red},{label:"Leave",value:leave,col:T.leave},{label:"Streak",value:streak+"d",col:T.accent}].map(k=>(
                <div key={k.label} style={{background:"rgba(255,255,255,.04)",borderRadius:13,padding:"12px 10px",border:`1px solid rgba(255,255,255,.06)`}}>
                  <div style={{fontSize:20,fontWeight:700,color:"#fff"}}>{k.value}</div>
                  <div style={{fontSize:10,color:k.col,marginTop:3,fontWeight:700,letterSpacing:.5}}>{k.label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            <Card style={{padding:20,display:"flex",alignItems:"center",gap:20}}>
              <Donut present={present} leave={leave} total={history.length}/>
              <div>
                <div style={{fontSize:11,color:T.muted,marginBottom:4}}>Attendance Rate</div>
                <div style={{fontSize:32,fontWeight:800,color:T.txt}}>
                  {Math.round(present/Math.max(history.length,1)*100)}<span style={{fontSize:16,color:T.green}}>%</span>
                </div>
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  {[{col:T.green,l:"Present"},{col:T.leave,l:"Leave"},{col:T.red,l:"Absent"}].map(x=>(
                    <div key={x.l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:T.muted}}>
                      <div style={{width:8,height:8,borderRadius:2,background:x.col}}/>{x.l}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card style={{padding:20}}>
              <div style={{fontSize:10,color:T.muted,marginBottom:12,letterSpacing:1}}>DAILY — 30 DAYS</div>
              <MiniBar history={history}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:7,fontSize:10,color:"rgba(255,255,255,.18)"}}>
                <span>30d ago</span><span>Today</span>
              </div>
            </Card>

            <Card style={{padding:20}}>
              <div style={{fontSize:10,color:T.muted,marginBottom:12,letterSpacing:1}}>HEATMAP</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:5}}>
                {history.map((d,i)=>{
                  const col=d.status==="present"?T.green:d.status==="leave"?T.leave:d.status==="absent"?T.red:"rgba(255,255,255,.06)";
                  return <div key={i} title={d.date} style={{width:16,height:16,borderRadius:4,background:col}}/>;
                })}
              </div>
            </Card>

            <Card style={{padding:20}}>
              <div style={{fontSize:10,color:T.muted,marginBottom:12,letterSpacing:1}}>RECENT ACTIVITY</div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {history.slice(-7).reverse().map((d,i)=>{
                  const {label,color}=statusMeta(d.status);
                  return (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,color:"rgba(255,255,255,.45)"}}>{fmtShort(d.date)}</span>
                      <Badge label={label} color={color} small/>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════
//  ADMIN — LEAVE REVIEW PANEL
// ══════════════════════════════════════════════════════
const LeavePanel = ({leaves, setLeaves, toast}) => {
  const [tab,    setTab]    = useState("pending");
  const [loading,setLoad]   = useState(null);

  const review = async (id, status) => {
    setLoad(id+status);
    try {
      const updated = await api.reviewLeave(id, status);
      setLeaves(prev=>prev.map(l=>l._id===id?updated:l));
      toast(`Leave ${status} successfully`, "success");
    } catch(e) { toast(e.message); }
    finally { setLoad(null); }
  };

  const filtered = leaves.filter(l=>l.status===tab);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:8}}>
        {["pending","approved","rejected"].map(t=>{
          const count=leaves.filter(l=>l.status===t).length;
          const {color}=statusMeta(t);
          return (
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:"8px 16px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .18s",
                background:tab===t?`${color}20`:"transparent",color:tab===t?color:T.muted,
                border:tab===t?`1px solid ${color}44`:`1px solid ${T.border}`,fontFamily:font}}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
              {count>0&&<span style={{background:`${color}30`,padding:"1px 7px",borderRadius:10,marginLeft:5}}>{count}</span>}
            </button>
          );
        })}
      </div>

      {filtered.length===0&&(
        <Card style={{padding:40,textAlign:"center"}}>
          <Inbox size={36} style={{color:T.muted,opacity:.25,margin:"0 auto 10px",display:"block"}}/>
          <div style={{color:T.muted,fontSize:14}}>No {tab} requests</div>
        </Card>
      )}

      <AnimatePresence>
        {filtered.map((l,i)=>{
          const st = l.studentId;
          const days = dateRange(l.from,l.to).length;
          return (
            <motion.div key={l._id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:i*.04}}>
              <Card style={{padding:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <Avatar name={st?.name||"?"} size={40} color={T.accent}/>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:T.txt}}>{st?.name}</div>
                      <div style={{fontSize:12,color:T.muted}}>Roll #{st?.rollNo}</div>
                    </div>
                  </div>
                  <Badge label={statusMeta(l.status).label} color={statusMeta(l.status).color}/>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                  {[{label:"Type",value:l.type},{label:"From",value:fmt(l.from)},{label:"To",value:fmt(l.to)},{label:"Days",value:`${days}d`},{label:"Applied",value:fmt(l.appliedAt)}].map(x=>(
                    <div key={x.label} style={{background:"rgba(255,255,255,.03)",borderRadius:10,padding:"9px 11px",border:`1px solid ${T.border}`}}>
                      <div style={{fontSize:10,color:T.muted,letterSpacing:.5,marginBottom:2}}>{x.label.toUpperCase()}</div>
                      <div style={{fontSize:13,color:T.txt,fontWeight:600}}>{x.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{background:"rgba(255,255,255,.03)",borderRadius:10,padding:"11px 13px",border:`1px solid ${T.border}`,marginBottom:l.status==="pending"?14:0}}>
                  <div style={{fontSize:10,color:T.muted,letterSpacing:.5,marginBottom:3}}>REASON</div>
                  <div style={{fontSize:13,color:T.txt,lineHeight:1.5}}>{l.reason}</div>
                </div>

                {l.status==="pending"&&(
                  <div style={{display:"flex",gap:10}}>
                    <Btn variant="success" size="sm" disabled={!!loading}
                      onClick={()=>review(l._id,"approved")} style={{flex:1,justifyContent:"center"}}>
                      {loading===l._id+"approved"?<Loader size={13} style={{animation:"spin 1s linear infinite"}}/>:<ThumbsUp size={14}/>} Approve
                    </Btn>
                    <Btn variant="danger" size="sm" disabled={!!loading}
                      onClick={()=>review(l._id,"rejected")} style={{flex:1,justifyContent:"center"}}>
                      {loading===l._id+"rejected"?<Loader size={13} style={{animation:"spin 1s linear infinite"}}/>:<ThumbsDown size={14}/>} Reject
                    </Btn>
                  </div>
                )}
                {l.status!=="pending"&&l.reviewedAt&&(
                  <div style={{fontSize:11,color:T.muted,marginTop:8}}>
                    {l.status==="approved"?"✅":"❌"} Reviewed on {fmt(l.reviewedAt)}
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ══════════════════════════════════════════════════════
const AdminDashboard = ({onLogout}) => {
  const [students,   setStudents]   = useState([]);
  const [attendance, setAttendance] = useState({});
  const [leaves,     setLeaves]     = useState([]);
  const [date,       setDate]       = useState(today());
  const [query,      setQuery]      = useState("");
  const [filter,     setFilter]     = useState("all");
  const [view,       setView]       = useState("attendance");
  const [drawer,     setDrawer]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [marking,    setMarking]    = useState(null);
  const [newS,       setNewS]       = useState({name:"",email:"",rollNo:"",password:"1234"});
  const [showAdd,    setShowAdd]    = useState(false);
  const [toastEl,    toast]         = useToast();

  const loadAll = useCallback(async()=>{
    setLoading(true);
    try {
      const [s,l] = await Promise.all([api.getStudents(), api.getLeaves()]);
      setStudents(s); setLeaves(l);
    } catch(e){ toast(e.message); }
    finally { setLoading(false); }
  },[]);

  const loadAtt = useCallback(async()=>{
    try { setAttendance(await api.getAttendance(date)); }
    catch(e){ toast(e.message); }
  },[date]);

  useEffect(()=>{ loadAll(); },[]);
  useEffect(()=>{ loadAtt(); },[date]);

  const getStatus = id => attendance[id] || "unmarked";

  const mark = async(sid,status,e)=>{
    e.stopPropagation();
    setMarking(sid+status);
    try {
      await api.markAttendance({studentId:sid, date, status});
      setAttendance(p=>({...p,[sid]:status}));
    } catch(e){ toast(e.message); }
    finally { setMarking(null); }
  };

  const addStudent = async()=>{
    if(!newS.name||!newS.email||!newS.rollNo) return toast("All fields required");
    try {
      const s=await api.addStudent(newS);
      setStudents(p=>[...p,s]);
      setNewS({name:"",email:"",rollNo:"",password:"1234"});
      setShowAdd(false);
      toast("Student added!","success");
    } catch(e){ toast(e.message); }
  };

  const deleteStudent = async(id,e)=>{
    e.stopPropagation();
    if(!confirm("Delete this student permanently?")) return;
    try {
      await api.deleteStudent(id);
      setStudents(p=>p.filter(s=>s._id!==id));
      toast("Student deleted","success");
    } catch(e){ toast(e.message); }
  };

  const pendingCount = leaves.filter(l=>l.status==="pending").length;

  const stats = useMemo(()=>{
    const all=students.map(s=>getStatus(s._id));
    return { total:students.length, present:all.filter(s=>s==="present").length, absent:all.filter(s=>s==="absent").length, leave:all.filter(s=>s==="leave").length };
  },[students,attendance]);

  const filtered = useMemo(()=>
    students
      .filter(s=>[s.name,s.email,s.rollNo].join(" ").toLowerCase().includes(query.toLowerCase()))
      .filter(s=>filter==="all"?true:getStatus(s._id)===filter),
  [students,query,filter,attendance]);

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.txt,padding:"24px 18px"}}>
      <div style={{maxWidth:1080,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>

        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${T.accent}12,transparent)`,border:`1px solid ${T.border}`,borderRadius:20,padding:"20px 26px",display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:11,background:`${T.accent}22`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Shield size={18} color={T.accent}/>
            </div>
            <div>
              <div style={{fontSize:20,fontWeight:800,color:T.txt}}>Admin Dashboard</div>
              <div style={{fontSize:12,color:T.muted}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:5,background:"rgba(255,255,255,.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:4}}>
              {[{k:"attendance",label:"Attendance"},{k:"leaves",label:`Leaves${pendingCount>0?` (${pendingCount})`:""}`}].map(t=>(
                <button key={t.k} onClick={()=>setView(t.k)}
                  style={{padding:"7px 13px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .18s",
                    background:view===t.k?T.accent:"transparent",color:view===t.k?"#fff":T.muted,border:"none",fontFamily:font}}>
                  {t.label}
                </button>
              ))}
            </div>
            {view==="attendance"&&(
              <>
                <div style={{display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,.05)",border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 14px"}}>
                  <Calendar size={13} color={T.accent}/>
                  <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                    style={{background:"transparent",border:"none",outline:"none",color:T.txt,fontFamily:font,fontSize:13}}/>
                </div>
                <Btn variant="secondary" size="sm" onClick={loadAtt}><RefreshCw size={13}/> Refresh</Btn>
              </>
            )}
            <Btn variant="secondary" size="sm" onClick={onLogout} style={{color:T.muted}}><LogOut size={13}/> Logout</Btn>
          </div>
        </div>

        {view==="attendance"&&(
          <>
            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:13}}>
              {[{key:"all",label:"Total",value:stats.total,color:"#818cf8"},{key:"present",label:"Present",value:stats.present,color:T.green},{key:"absent",label:"Absent",value:stats.absent,color:T.red},{key:"leave",label:"On Leave",value:stats.leave,color:T.leave}].map(c=>(
                <motion.div key={c.key} whileHover={{y:-3}} whileTap={{scale:.97}}
                  onClick={()=>setFilter(filter===c.key?"all":c.key)}
                  style={{background:filter===c.key?`linear-gradient(135deg,${c.color}22,${c.color}08)`:T.card,
                    border:filter===c.key?`1px solid ${c.color}44`:`1px solid ${T.border}`,
                    borderRadius:18,padding:"18px 20px",cursor:"pointer",transition:"all .22s"}}>
                  <div style={{fontSize:32,fontWeight:800,color:T.txt,lineHeight:1}}>{c.value}</div>
                  <div style={{fontSize:11,color:c.color,fontWeight:700,marginTop:5,letterSpacing:.3}}>{c.label.toUpperCase()}</div>
                </motion.div>
              ))}
            </div>

            {/* Search + Add */}
            <Card style={{padding:"16px 20px"}}>
              <div style={{display:"flex",gap:8,marginBottom:showAdd?14:0,flexWrap:"wrap"}}>
                <div style={{position:"relative",flex:1,minWidth:180}}>
                  <Search size={13} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:T.muted}}/>
                  <Inp placeholder="Search…" value={query} onChange={e=>setQuery(e.target.value)} style={{paddingLeft:32}}/>
                </div>
                {["all","present","absent","leave","unmarked"].map(f=>(
                  <button key={f} onClick={()=>setFilter(f)}
                    style={{padding:"8px 12px",borderRadius:9,fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s",
                      background:filter===f?T.accent:"transparent",color:filter===f?"#fff":T.muted,
                      border:filter===f?`1px solid ${T.accent}`:`1px solid ${T.border}`,fontFamily:font}}>
                    {f.charAt(0).toUpperCase()+f.slice(1)}
                  </button>
                ))}
                <Btn size="sm" onClick={()=>setShowAdd(p=>!p)}><PlusCircle size={13}/> Add Student</Btn>
              </div>
              {showAdd&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 0.6fr 0.6fr auto",gap:8}}>
                  {[["name","Name"],["email","Email"],["rollNo","Roll No"],["password","Password (default: 12344)"]].map(([f,ph])=>(
                    <Inp key={f} placeholder={ph} value={newS[f]} onChange={e=>setNewS(p=>({...p,[f]:e.target.value}))}/>
                  ))}
                  <Btn onClick={addStudent}><CheckCircle size={14}/> Save</Btn>
                </div>
              )}
            </Card>

            {/* Table */}
            <Card style={{overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1.8fr .7fr 1.1fr 160px",padding:"12px 20px",background:"rgba(255,255,255,.025)",borderBottom:`1px solid ${T.border}`}}>
                {["Student","Email","Roll","Status","Actions"].map(h=>(
                  <div key={h} style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1}}>{h.toUpperCase()}</div>
                ))}
              </div>

              {loading&&<div style={{padding:40,textAlign:"center",color:T.muted}}><Loader size={22} style={{animation:"spin 1s linear infinite",margin:"0 auto 10px",display:"block"}} color={T.accent}/> Loading…</div>}
              {!loading&&filtered.length===0&&<div style={{padding:40,textAlign:"center",color:T.muted,fontSize:14}}>No students found</div>}

              <AnimatePresence>
                {filtered.map((s,i)=>{
                  const status=getStatus(s._id);
                  const {label,color}=statusMeta(status);
                  return (
                    <motion.div key={s._id} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:i*.025}}
                      onClick={()=>setDrawer(s)}
                      style={{display:"grid",gridTemplateColumns:"2fr 1.8fr .7fr 1.1fr 160px",
                        padding:"14px 20px",borderBottom:`1px solid ${T.border}`,cursor:"pointer",alignItems:"center",transition:"background .12s"}}>

                      <div style={{display:"flex",alignItems:"center",gap:11}}>
                        <Avatar name={s.name} size={36} color={T.accent}/>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:T.txt}}>{s.name}</div>
                          <div style={{fontSize:11,color:T.muted,marginTop:1,display:"flex",alignItems:"center",gap:3}}>
                            {status==="leave"?"📋 On approved leave":"View profile"}<ChevronRight size={10}/>
                          </div>
                        </div>
                      </div>

                      <div style={{fontSize:13,color:T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8}}>{s.email}</div>
                      <div style={{fontSize:13,fontWeight:600,color:T.txt}}>#{s.rollNo}</div>
                      <div><Badge label={label} color={color}/></div>

                      <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                        {status==="leave"?(
                          <div style={{fontSize:11,color:T.leave,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                            <CalendarDays size={13}/> Auto-Leave
                          </div>
                        ):(
                          <>
                            <motion.button whileHover={{scale:1.1}} whileTap={{scale:.9}}
                              onClick={e=>mark(s._id,"present",e)}
                              disabled={!!marking}
                              style={{background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.2)",borderRadius:8,padding:"7px 10px",cursor:"pointer",color:T.green,display:"flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,fontFamily:font}}>
                              {marking===s._id+"present"?<Loader size={12} style={{animation:"spin 1s linear infinite"}}/>:<CheckCircle size={12}/>} P
                            </motion.button>
                            <motion.button whileHover={{scale:1.1}} whileTap={{scale:.9}}
                              onClick={e=>mark(s._id,"absent",e)}
                              disabled={!!marking}
                              style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.2)",borderRadius:8,padding:"7px 10px",cursor:"pointer",color:T.red,display:"flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,fontFamily:font}}>
                              {marking===s._id+"absent"?<Loader size={12} style={{animation:"spin 1s linear infinite"}}/>:<XCircle size={12}/>} A
                            </motion.button>
                          </>
                        )}
                        <motion.button whileHover={{scale:1.1}} whileTap={{scale:.9}}
                          onClick={e=>deleteStudent(s._id,e)}
                          style={{background:"rgba(255,255,255,.04)",border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 9px",cursor:"pointer",color:T.muted}}>
                          <Trash2 size={12}/>
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <div style={{padding:"10px 20px",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:12,color:T.muted}}>{filtered.length} of {students.length}</span>
                <span style={{fontSize:12,color:T.muted}}>{stats.present}P · {stats.absent}A · {stats.leave}L · {stats.total-stats.present-stats.absent-stats.leave} unmarked</span>
              </div>
            </Card>
          </>
        )}

        {view==="leaves"&&<LeavePanel leaves={leaves} setLeaves={setLeaves} toast={toast}/>}
      </div>

      <AnimatePresence>
        {drawer&&<StudentDrawer student={drawer} onClose={()=>setDrawer(null)}/>}
      </AnimatePresence>
      <AnimatePresence>{toastEl}</AnimatePresence>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  STUDENT PORTAL
// ══════════════════════════════════════════════════════
const StudentPortal = ({student, onLogout}) => {
  const [leaves,  setLeaves]  = useState([]);
  const [view,    setView]    = useState("dashboard");
  const [form,    setForm]    = useState({from:"",to:"",type:"Medical",reason:""});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [toastEl, toast]      = useToast();

  useEffect(()=>{
    api.getLeaves()
      .then(setLeaves)
      .catch(e=>toast(e.message))
      .finally(()=>setLoading(false));
  },[]);

  const myLeaves = leaves.sort((a,b)=>b.appliedAt.localeCompare(a.appliedAt));
  const pending  = myLeaves.filter(l=>l.status==="pending").length;
  const approved = myLeaves.filter(l=>l.status==="approved").length;

  const submitLeave = async()=>{
    if(!form.from||!form.to||form.reason.trim().length<20) return toast("Fill all fields (reason min 20 chars)");
    if(form.to<form.from) return toast("End date must be after start date");
    setSaving(true);
    try {
      const newLeave = await api.applyLeave({...form, reason:form.reason.trim()});
      setLeaves(p=>[newLeave,...p]);
      setForm({from:"",to:"",type:"Medical",reason:""});
      setSuccess(true);
      setTimeout(()=>{ setSuccess(false); setView("dashboard"); },2000);
    } catch(e){ toast(e.message); }
    finally { setSaving(false); }
  };

  const cancelLeave = async(id)=>{
    try {
      await api.deleteLeave(id);
      setLeaves(p=>p.filter(l=>l._id!==id));
      toast("Leave cancelled","success");
    } catch(e){ toast(e.message); }
  };

  const leaveTypes = ["Medical","Family Emergency","casual",,"Personal","Academic","Travel","Other"];

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.txt,padding:"24px 18px"}}>
      <div style={{maxWidth:720,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>

        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${T.leave}12,transparent)`,border:`1px solid ${T.border}`,borderRadius:20,padding:"20px 26px",display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:13}}>
            <Avatar name={student.name} size={46} color={T.leave}/>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:T.txt}}>{student.name}</div>
              <div style={{fontSize:12,color:T.muted}}>Roll #{student.rollNo} · Student Portal</div>
            </div>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:5,background:"rgba(255,255,255,.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:4}}>
              {[{k:"dashboard",label:"My Leaves"},{k:"apply",label:"Apply Leave"}].map(t=>(
                <button key={t.k} onClick={()=>{ setView(t.k); setSuccess(false); }}
                  style={{padding:"7px 12px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .15s",
                    background:view===t.k?T.leave:"transparent",color:view===t.k?"#fff":T.muted,border:"none",fontFamily:font}}>
                  {t.label}
                </button>
              ))}
            </div>
            <Btn variant="secondary" size="sm" onClick={onLogout} style={{color:T.muted}}><LogOut size={13}/> Logout</Btn>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:13}}>
          {[{label:"Total Applied",value:myLeaves.length,color:T.accent},{label:"Approved",value:approved,color:T.green},{label:"Pending",value:pending,color:T.amber}].map(k=>(
            <Card key={k.label} style={{padding:"18px 20px"}}>
              <div style={{fontSize:28,fontWeight:800,color:T.txt}}>{k.value}</div>
              <div style={{fontSize:11,color:k.color,fontWeight:700,marginTop:5,letterSpacing:.3}}>{k.label.toUpperCase()}</div>
            </Card>
          ))}
        </div>

        {/* Apply form */}
        {view==="apply"&&(
          <Card style={{padding:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
              <div style={{width:36,height:36,borderRadius:11,background:`${T.leave}22`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <FileText size={17} color={T.leave}/>
              </div>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:T.txt}}>Leave Application</div>
                <div style={{fontSize:12,color:T.muted}}>Your teacher will review and approve/reject this request.</div>
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={{display:"block",fontSize:11,color:T.muted,letterSpacing:.6,marginBottom:7}}>FROM DATE *</label>
                  <Inp type="date" value={form.from} min={today()} onChange={e=>setForm(p=>({...p,from:e.target.value}))}/>
                </div>
                <div>
                  <label style={{display:"block",fontSize:11,color:T.muted,letterSpacing:.6,marginBottom:7}}>TO DATE *</label>
                  <Inp type="date" value={form.to} min={form.from||today()} onChange={e=>setForm(p=>({...p,to:e.target.value}))}/>
                </div>
              </div>

              {form.from&&form.to&&form.to>=form.from&&(
                <motion.div initial={{opacity:0}} animate={{opacity:1}}
                  style={{background:`${T.leave}12`,border:`1px solid ${T.leave}33`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                  <CalendarDays size={14} color={T.leave}/>
                  <span style={{fontSize:13,color:T.leave,fontWeight:600}}>
                    {dateRange(form.from,form.to).length} day{dateRange(form.from,form.to).length>1?"s":""} — {fmt(form.from)}{form.from!==form.to?` → ${fmt(form.to)}`:""}
                  </span>
                </motion.div>
              )}

              <div>
                <label style={{display:"block",fontSize:11,color:T.muted,letterSpacing:.6,marginBottom:7}}>LEAVE TYPE *</label>
                <Sel value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                  {leaveTypes.map(t=><option key={t} value={t} style={{background:"#1a1a2e"}}>{t}</option>)}
                </Sel>
              </div>

              <div>
                <label style={{display:"block",fontSize:11,color:T.muted,letterSpacing:.6,marginBottom:7}}>REASON / DETAILS *</label>
                <textarea value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))}
                  placeholder="Explain why you need leave. Minimum 20 characters required."
                  rows={5}
                  style={{background:"rgba(255,255,255,.05)",border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",color:T.txt,fontFamily:font,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",resize:"vertical",lineHeight:1.6}}/>
                <div style={{textAlign:"right",fontSize:11,color:form.reason.length<20?T.red:T.muted,marginTop:4}}>
                  {form.reason.length} / min 20 chars {form.reason.length>=20?"✓":""}
                </div>
              </div>

              <div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",borderRadius:10,padding:"11px 14px",display:"flex",gap:9,alignItems:"flex-start"}}>
                <AlertCircle size={14} color={T.amber} style={{flexShrink:0,marginTop:2}}/>
                <div style={{fontSize:12,color:"rgba(245,158,11,.9)",lineHeight:1.5}}>
                  <strong>Note:</strong> Once approved by your teacher, attendance for those dates will automatically show <span style={{color:T.leave,fontWeight:700}}>"On Leave"</span>.
                </div>
              </div>

              <AnimatePresence>
                {success?(
                  <motion.div initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
                    style={{background:"rgba(34,197,94,.12)",border:"1px solid rgba(34,197,94,.3)",borderRadius:12,padding:"15px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                    <CheckCircle size={20} color={T.green}/>
                    <span style={{fontSize:15,fontWeight:700,color:T.green}}>Application submitted! Redirecting…</span>
                  </motion.div>
                ):(
                  <Btn onClick={submitLeave} disabled={saving||(form.reason.length<20)} style={{justifyContent:"center",padding:"13px 20px"}}>
                    {saving?<><Loader size={14} style={{animation:"spin 1s linear infinite"}}/> Submitting…</>:<><Send size={14}/> Submit Application</>}
                  </Btn>
                )}
              </AnimatePresence>
            </div>
          </Card>
        )}

        {/* My leaves list */}
        {view==="dashboard"&&(
          loading?(
            <div style={{padding:40,textAlign:"center",color:T.muted}}>
              <Loader size={22} style={{animation:"spin 1s linear infinite",margin:"0 auto 10px",display:"block"}} color={T.accent}/>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {myLeaves.length===0&&(
                <Card style={{padding:48,textAlign:"center"}}>
                  <BookOpen size={40} style={{color:T.muted,opacity:.2,margin:"0 auto 12px",display:"block"}}/>
                  <div style={{fontSize:15,color:T.muted}}>No applications yet</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:4}}>Tap "Apply Leave" to request time off</div>
                </Card>
              )}
              <AnimatePresence>
                {myLeaves.map((l,i)=>{
                  const days=dateRange(l.from,l.to).length;
                  const {label,color}=statusMeta(l.status);
                  return (
                    <motion.div key={l._id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*.04}}>
                      <Card style={{padding:20}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                          <div>
                            <div style={{fontSize:15,fontWeight:700,color:T.txt,marginBottom:2}}>{l.type} Leave</div>
                            <div style={{fontSize:12,color:T.muted}}>Applied {fmt(l.appliedAt)}</div>
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <Badge label={label} color={color}/>
                            {l.status==="pending"&&(
                              <motion.button whileHover={{scale:1.1}} whileTap={{scale:.9}}
                                onClick={()=>cancelLeave(l._id)}
                                style={{background:"rgba(244,63,94,.1)",border:`1px solid ${T.red}33`,borderRadius:8,padding:"5px 8px",cursor:"pointer",color:T.red}}>
                                <Trash2 size={13}/>
                              </motion.button>
                            )}
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
                          {[{label:"From",value:fmt(l.from)},{label:"To",value:fmt(l.to)},{label:"Days",value:`${days}d`}].map(x=>(
                            <div key={x.label} style={{background:"rgba(255,255,255,.03)",borderRadius:9,padding:"9px 11px",border:`1px solid ${T.border}`}}>
                              <div style={{fontSize:10,color:T.muted,letterSpacing:.5,marginBottom:2}}>{x.label.toUpperCase()}</div>
                              <div style={{fontSize:13,color:T.txt,fontWeight:600}}>{x.value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{background:"rgba(255,255,255,.03)",borderRadius:9,padding:"10px 12px",border:`1px solid ${T.border}`}}>
                          <div style={{fontSize:10,color:T.muted,letterSpacing:.5,marginBottom:3}}>REASON</div>
                          <div style={{fontSize:13,color:T.txt,lineHeight:1.5}}>{l.reason}</div>
                        </div>
                        {l.status==="pending"&&<div style={{marginTop:10,fontSize:12,color:T.amber,display:"flex",alignItems:"center",gap:6}}><Clock size={12}/> Awaiting teacher review…</div>}
                        {l.status==="approved"&&<div style={{marginTop:10,fontSize:12,color:T.green,display:"flex",alignItems:"center",gap:6}}><CheckCircle size={12}/> Approved on {fmt(l.reviewedAt)} — attendance auto-marked.</div>}
                        {l.status==="rejected"&&<div style={{marginTop:10,fontSize:12,color:T.red,display:"flex",alignItems:"center",gap:6}}><XCircle size={12}/> Rejected on {fmt(l.reviewedAt)}.</div>}
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )
        )}
      </div>
      <AnimatePresence>{toastEl}</AnimatePresence>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════
const Login = ({onLogin}) => {
  const [role,  setRole]  = useState("student");
  const [roll,  setRoll]  = useState("");
  const [pass,  setPass]  = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading,setLoad] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const submit = async()=>{
    setError(""); setLoad(true);
    try {
      let data;
      if(role==="admin") data = await api.adminLogin(email, pass);
      else               data = await api.studentLogin(roll, pass);
      localStorage.setItem("att_token", data.token);
      localStorage.setItem("att_role",  data.role);
      if(data.student) localStorage.setItem("att_student", JSON.stringify(data.student));
      onLogin(data);
    } catch(e){
      setError(e.message);
    } finally { setLoad(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:font,color:T.txt,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{position:"fixed",top:"-15%",left:"-10%",width:500,height:500,borderRadius:"50%",background:`radial-gradient(${T.accent}18,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"-10%",right:"-5%",width:400,height:400,borderRadius:"50%",background:`radial-gradient(${T.leave}14,transparent 70%)`,pointerEvents:"none"}}/>

      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{type:"spring",stiffness:200,damping:22}}
        style={{width:"100%",maxWidth:400}}>

        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:54,height:54,borderRadius:16,background:`${T.accent}22`,border:`1px solid ${T.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
            <BookOpen size={24} color={T.accent}/>
          </div>
          <div style={{fontSize:24,fontWeight:800,color:T.txt}}>Attendance Pro</div>
          <div style={{fontSize:13,color:T.muted,marginTop:3}}>University Attendance System</div>
        </div>

        <Card style={{padding:26}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,background:"rgba(255,255,255,.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:4,marginBottom:22}}>
            {[{k:"student",icon:<Users size={14}/>,label:"Student"},{k:"admin",icon:<Shield size={14}/>,label:"Admin"}].map(r=>(
              <button key={r.k} onClick={()=>{ setRole(r.k); setError(""); }}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px 0",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .18s",
                  background:role===r.k?T.accent:"transparent",color:role===r.k?"#fff":T.muted,border:"none",fontFamily:font}}>
                {r.icon}{r.label}
              </button>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:13}}>
            {role==="student"&&(
              <div>
                <label style={{display:"block",fontSize:11,color:T.muted,letterSpacing:.6,marginBottom:7}}>ROLL NUMBER</label>
                <Inp placeholder="e.g. CS-101" value={roll} onChange={e=>setRoll(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
              </div>
            )}
            {role==="admin"&&(
              <div>
                <label style={{display:"block",fontSize:11,color:T.muted,letterSpacing:.6,marginBottom:7}}>EMAIL</label>
                <Inp placeholder="e.g. admin@uni.edu" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
              </div>
            )}
            <div>
              <label style={{display:"block",fontSize:11,color:T.muted,letterSpacing:.6,marginBottom:7}}>PASSWORD</label>
              <div style={{position:"relative",display:"flex",alignItems:"center"}}>
                <Inp type={showPass?"text":"password"} placeholder={role==="admin"?"Admin password":"Your password"} value={pass}
                  onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
                <button onClick={()=>setShowPass(!showPass)} 
                  style={{position:"absolute",right:14,background:"none",border:"none",cursor:"pointer",color:T.muted,padding:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {showPass?<Eye size={16} color={T.accent}/>:<EyeOff size={16} color={T.muted}/>}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error&&(
                <motion.div initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                  style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.25)",borderRadius:10,padding:"10px 14px",display:"flex",gap:8,alignItems:"center"}}>
                  <WifiOff size={13} color={T.red}/><span style={{fontSize:12,color:T.red}}>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <Btn onClick={submit} disabled={loading} style={{justifyContent:"center",padding:"13px 20px"}}>
              {loading?<><Loader size={14} style={{animation:"spin 1s linear infinite"}}/> Signing in…</>:<><Send size={14}/> Sign In →</>}
            </Btn>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null);

  // Restore session from localStorage on mount
  useEffect(()=>{
    const token = localStorage.getItem("att_token");
    const role  = localStorage.getItem("att_role");
    if(!token||!role) return;
    if(role==="admin") setSession({role:"admin"});
    else {
      const student = JSON.parse(localStorage.getItem("att_student")||"null");
      if(student) setSession({role:"student",student});
    }
  },[]);

  const logout = ()=>{
    localStorage.removeItem("att_token");
    localStorage.removeItem("att_role");
    localStorage.removeItem("att_student");
    setSession(null);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${T.bg};font-family:${font}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${T.accent}55;border-radius:4px}
        input::placeholder,textarea::placeholder{color:${T.muted}}
        select option{background:#1a1a2e;color:#eaeaf5}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <AnimatePresence mode="wait">
        {!session&&(
          <motion.div key="login" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,scale:.97}}>
            <Login onLogin={s=>setSession(s)}/>
          </motion.div>
        )}
        {session?.role==="admin"&&(
          <motion.div key="admin" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <AdminDashboard onLogout={logout}/>
          </motion.div>
        )}
        {session?.role==="student"&&(
          <motion.div key="student" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <StudentPortal student={session.student} onLogout={logout}/>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}