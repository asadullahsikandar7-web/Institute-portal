// ═══════════════════════════════════════════════════════════════════
//  ACADEXA by ASAD — Zero localStorage, All Real Backend Data
//  Token lives ONLY in React state. Every module fetches from DB.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, CheckCircle, XCircle, Calendar, Search, X, LogOut,
  Send, Inbox, Shield, BookOpen, PlusCircle, CalendarDays,
  AlertCircle, FileText, Clock, ChevronRight, Trash2,
  ThumbsUp, ThumbsDown, RefreshCw, WifiOff, Eye, EyeOff,
  Loader, Bell, BarChart2, TrendingUp, Award, Star,
  DollarSign, Grid, Layers, UserCheck, Hash, Zap,
  CheckSquare, Activity, Target, BookMarked, GraduationCap,
  Megaphone, CreditCard, Coffee, Sun, Moon, Edit3,
  ChevronDown, ChevronUp, MoreHorizontal, Download,
  AlignLeft, Cpu, Flame, MessageSquare, Globe, Lock,
  User, Settings, Home, LayoutDashboard, Package,
  AlertTriangle, Info, Check, ArrowUp, ArrowDown,
  Minus, BarChart, PieChart, TrendingDown, Menu, Filter, Camera, Upload, ZoomIn,
  Play, Copy, Mail, Fingerprint, Sparkles, ShieldCheck
} from "lucide-react";
// https://asad-backend2.vercel.app
// ═════════════════════════════════════════════════════=
//  BASE URL
// ═════════════════════════════════════════════════════=
// Pick a runtime-appropriate base URL:
// - During local frontend development (Vite at 5173 or CRA at 3000) use the standalone backend: http://localhost:5001
// - During Netlify dev or production (frontend served by Netlify), use a relative `/api` prefix which Netlify redirects to the function
let BASE = "http://localhost:5001"; // default for Node/tooling
if (typeof window !== "undefined") {
  const host = window.location.hostname;
  // If running frontend on localhost (any port) use local backend
  if (host === "localhost" || host === "127.0.0.1") {
    BASE = "http://localhost:5001";
  } else {
    // For Netlify (dev or prod) and other hosts, use relative paths so `/api/...` goes to same origin
    // Set BASE to empty string so API paths like `/api/auth` resolve to the current host
    BASE = "";
  }
}
// /api/auth/admin-login
// ══════════════════════════════════════════════════════
//  API FACTORY — token passed as arg, never from storage
// ══════════════════════════════════════════════════════
function makeApi(token) {
  function headers() {
    const h = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }
  function headersFormData() {
    const h = {};
    if (token) h["Authorization"] = `Bearer ${token}`;
    // Content-Type should NOT be set for FormData, let browser set it
    return h;
  }
  async function req(method, path, body) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      if (err.name === "TypeError") throw new Error("Cannot reach server. Is it running?");
      throw err;
    }
  }
  async function reqFormData(method, path, formData) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: headersFormData(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      if (err.name === "TypeError") throw new Error("Cannot reach server. Is it running?");
      throw err;
    }
  }
  return {
    // Auth (no token needed)
    adminLogin:   (email, password) => req("POST", "/api/auth/admin-login",   { email, password }),
    studentLogin: (rollNo, password)=> req("POST", "/api/auth/student-login", { rollNo, password }),
    // Students
    getStudents:   ()         => req("GET",    "/api/students"),
    addStudent:    (body)     => req("POST",   "/api/students", body),
    deleteStudent: (id)       => req("DELETE", `/api/students/${id}`),
    uploadPhoto:   (id, file) => {
      const fd = new FormData();
      fd.append("photo", file);
      return reqFormData("PATCH", `/api/students/${id}/photo`, fd);
    },
    deletePhoto:   (id)       => req("DELETE", `/api/students/${id}/photo`),
    // Attendance
    getAttendance: (date)     => req("GET",  `/api/attendance?date=${date}`),
    getHistory:    (sid, days)=> req("GET",  `/api/attendance/history/${sid}?days=${days||30}`),
    markAttendance:(body)     => req("POST", "/api/attendance", body),
    // Leaves
    getLeaves:  ()            => req("GET",    "/api/leaves"),
    applyLeave: (body)        => req("POST",   "/api/leaves", body),
    reviewLeave:(id, status)  => req("PATCH",  `/api/leaves/${id}`, { status }),
    deleteLeave:(id)          => req("DELETE", `/api/leaves/${id}`),
    // Exams
    getExams: ()              => req("GET",  "/api/exams"),
    addExam:  (body)          => req("POST", "/api/exams", body),
    // Grades
    getGrades: (sid)          => req("GET",  `/api/grades/${sid}`),
    addGrade:  (body)         => req("POST", "/api/grades", body),
    // Announcements (using notifications with type="announcement")
    getAnnouncements: ()      => req("GET",  "/api/notifications?type=announcement"),
    addAnnouncement:  (body)  => req("POST", "/api/notifications", {...body, type: "announcement", recipientId: null }),
    // Fees
    getFees:    (sid)         => req("GET",   sid ? `/api/fees/${sid}` : "/api/fees"),
    payFee:     (id)          => req("PATCH", `/api/fees/${id}`, { paid: true }),
    addFee:     (body)        => req("POST",  "/api/fees", body),
    // Timetable
    getTimetable:  ()         => req("GET",  "/api/timetable"),
    addTimetable:  (body)     => req("POST", "/api/timetable", body),
    // Classes
    getClasses:          ()         => req("GET",  "/api/classes"),
    getTomorrowClasses:  ()         => req("GET",  "/api/classes/tomorrow"),
    addClass:            (body)     => req("POST", "/api/classes", body),
    updateClass:         (id, body) => req("PUT",  `/api/classes/${id}`, body),
    setTomorrowClass:    (id, body) => req("PUT",  `/api/classes/${id}/tomorrow`, body),
    deleteClass:         (id)       => req("DELETE", `/api/classes/${id}`),
    // Notifications
    getNotifications:     ()        => req("GET",  "/api/notifications"),
    getUnreadCount:       ()        => req("GET",  "/api/notifications/unread"),
    markAsRead:           (id)      => req("PATCH",  `/api/notifications/${id}/read`),
    sendNotification:     (body)    => req("POST", "/api/notifications", body),
    broadcastNotification:(body)    => req("POST", "/api/notifications", {...body, recipientId: null }),
    deleteNotification:   (id)      => req("DELETE", `/api/notifications/${id}`),
    // Analytics
    getAnalytics: ()          => req("GET",  "/api/analytics"),
    // Parents
    getParentMessages:  ()    => req("GET",    "/api/parent-messages"),
    sendParentMessage:  (body)=> req("POST",   "/api/parent-messages", body),
    resendParentMsg:    (id)  => req("POST",   `/api/parent-messages/${id}`),
    deleteParentMsg:    (id)  => req("DELETE", `/api/parent-messages/${id}`),
  };
}

// ══════════════════════════════════════════════════════
//  DESIGN SYSTEM
// ══════════════════════════════════════════════════════
const themes = {
  dark: {
    bg:"#05060f", bg2:"#080a18", panel:"#0c0e1e", surface:"#101328", surface2:"#161932",
    border:"rgba(255,255,255,0.07)", borderMd:"rgba(255,255,255,0.12)",
    indigo:"#6c63ff", indigoLt:"#8b85ff", cyan:"#22d3ee", emerald:"#10b981",
    rose:"#f43f5e", amber:"#f59e0b", violet:"#a78bfa", purple:"#8b5cf6", pink:"#ec4899",
    sky:"#38bdf8", orange:"#f97316",
    txt:"#e2e4f0", txt2:"#9698b0", dim:"rgba(228,230,240,0.2)",
    success:"#10b981", error:"#f43f5e", warn:"#f59e0b", info:"#22d3ee",
  },
  light: {
    bg:"#eff2ff", bg2:"#f8f9ff", panel:"#ffffff", surface:"#ffffff", surface2:"#f3f4ff",
    border:"rgba(15,23,42,0.08)", borderMd:"rgba(15,23,42,0.14)",
    indigo:"#5b4bff", indigoLt:"#8b5cf6", cyan:"#22d3ee", emerald:"#10b981",
    rose:"#ef4444", amber:"#f59e0b", violet:"#8b5cf6", purple:"#8b5cf6", pink:"#ec4899",
    sky:"#38bdf8", orange:"#fb923c",
    txt:"#0f172a", txt2:"#475569", dim:"rgba(15,23,42,0.2)",
    success:"#10b981", error:"#ef4444", warn:"#f59e0b", info:"#22d3ee",
  }
};
let C = themes.dark;
const F  = "'Outfit', 'DM Sans', system-ui, sans-serif";
const FD = "'Bebas Neue', 'Outfit', sans-serif";

// ══════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════
const today    = () => new Date().toISOString().split("T")[0];
const fmt      = d  => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmtShort = d  => new Date(d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const dateRange= (f,t)=>{const d=[],c=new Date(f);while(c<=new Date(t)){d.push(c.toISOString().split("T")[0]);c.setDate(c.getDate()+1);}return d;};
const gradeColor = g => g>=90?C.emerald:g>=75?C.cyan:g>=60?C.amber:C.rose;
const gradeLabel = g => g>=90?"A+":g>=85?"A":g>=80?"B+":g>=75?"B":g>=70?"C+":g>=65?"C":g>=60?"D":"F";
const statusMeta = s => ({
  present:{label:"Present",color:C.emerald,bg:"rgba(16,185,129,0.1)"},
  absent: {label:"Absent", color:C.rose,   bg:"rgba(244,63,94,0.1)"},
  leave:  {label:"On Leave",color:C.violet,bg:"rgba(167,139,250,0.1)"},
  unmarked:{label:"Unmarked",color:C.txt2, bg:"rgba(255,255,255,0.05)"},
  pending: {label:"Pending", color:C.amber, bg:"rgba(245,158,11,0.1)"},
  approved:{label:"Approved",color:C.emerald,bg:"rgba(16,185,129,0.1)"},
  rejected:{label:"Rejected",color:C.rose,  bg:"rgba(244,63,94,0.1)"},
  paid:    {label:"Paid",    color:C.emerald,bg:"rgba(16,185,129,0.1)"},
  unpaid:  {label:"Unpaid",  color:C.rose,  bg:"rgba(244,63,94,0.1)"},
  overdue: {label:"Overdue", color:C.orange,bg:"rgba(249,115,22,0.1)"},
  upcoming:{label:"Upcoming",color:C.amber, bg:"rgba(245,158,11,0.1)"},
  completed:{label:"Completed",color:C.emerald,bg:"rgba(16,185,129,0.1)"},
})[s] || {label:s,color:C.txt2,bg:"rgba(255,255,255,0.05)"};

const subjectColors = {
  "Mathematics":C.indigo,"Physics":C.cyan,"Computer Science":C.emerald,
  "Chemistry":C.orange,"English":C.pink,"Islamiyat":C.amber,"Pak Studies":C.violet,
};

// ══════════════════════════════════════════════════════
//  ROOM MANAGEMENT UTILITY
// ══════════════════════════════════════════════════════
const generateRooms = () => {
  const rooms = [];
  const blocks = ['A', 'B', 'C'];
  const floors = ['B', '1', '2', '3']; // B = Basement, 1-3 = Regular floors
  
  blocks.forEach(block => {
    floors.forEach(floor => {
      for (let room = 1; room <= 9; room++) {
        const roomNum = String(room).padStart(2, '0');
        const roomCode = `${block}${floor}${roomNum}`;
        const address = `${block} Block, ${floor === 'B' ? 'Basement' : `Floor ${floor}`}, Room ${room}`;
        rooms.push({ code: roomCode, label: `${roomCode} - ${address}` });
      }
    });
  });
  
  return rooms;
};

const allRooms = generateRooms();

// ══════════════════════════════════════════════════════
//  CORE COMPONENTS
// ══════════════════════════════════════════════════════
const Avatar = ({ name, size=38, color=C.indigo, img }) => {
  const initials = name ? name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?";
  return (
    <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,overflow:"hidden",
      background:`linear-gradient(135deg,${color}44,${color}18)`,border:`1.5px solid ${color}33`,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontWeight:800,fontSize:size*0.34,color,fontFamily:F,letterSpacing:0.5}}>
      {img ? <img src={img} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={name}/> : initials}
    </div>
  );
};

const Pill = ({label,color,bg,size="sm"}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:4,
    padding:size==="xs"?"2px 7px":"3px 10px",borderRadius:20,
    fontSize:size==="xs"?9:11,fontWeight:700,letterSpacing:0.3,background:bg,color,border:`1px solid ${color}25`}}>
    <span style={{width:4,height:4,borderRadius:"50%",background:color,flexShrink:0}}/>
    {label}
  </span>
);
const StatusPill = ({status,size}) => { const m=statusMeta(status); return <Pill label={m.label} color={m.color} bg={m.bg} size={size}/>; };

const Card = ({children,style={},hover=false,glow=false,onClick}) => (
  <motion.div whileHover={hover||onClick?{y:-2}:{}} onClick={onClick}
    style={{background:C.surface,border:`1px solid ${glow?C.borderMd:C.border}`,borderRadius:18,
      backdropFilter:"blur(12px)",
      boxShadow:glow?`0 0 40px rgba(108,99,255,0.08),inset 0 1px 0 rgba(255,255,255,0.04)`:`inset 0 1px 0 rgba(255,255,255,0.03)`,
      cursor:onClick?"pointer":"default",transition:"all 0.22s",...style}}>{children}</motion.div>
);

const Btn = ({children,variant="primary",size="md",onClick,disabled,full,style={}}) => {
  const V = {
    primary:{bg:`linear-gradient(135deg,${C.indigo},${C.indigoLt})`,color:"#fff",border:"none",shadow:`0 4px 20px ${C.indigo}35`},
    teal:   {bg:`linear-gradient(135deg,${C.cyan},${C.sky})`,color:"#040810",border:"none",shadow:`0 4px 20px ${C.cyan}30`},
    ghost:  {bg:"rgba(255,255,255,0.05)",color:C.txt2,border:`1px solid ${C.border}`,shadow:"none"},
    danger: {bg:"rgba(244,63,94,0.1)",color:C.rose,border:`1px solid rgba(244,63,94,0.2)`,shadow:"none"},
    success:{bg:"rgba(16,185,129,0.1)",color:C.emerald,border:`1px solid rgba(16,185,129,0.2)`,shadow:"none"},
    amber:  {bg:"rgba(245,158,11,0.1)",color:C.amber,border:`1px solid rgba(245,158,11,0.2)`,shadow:"none"},
  };
  const v = V[variant]||V.primary;
  return (
    <motion.button whileHover={disabled?{}:{scale:1.03,y:-1}} whileTap={disabled?{}:{scale:0.97}}
      onClick={disabled?undefined:onClick}
      style={{background:v.bg,border:v.border,color:v.color,borderRadius:10,
        padding:size==="xs"?"5px 10px":size==="sm"?"7px 14px":size==="lg"?"12px 28px":"9px 18px",
        cursor:disabled?"not-allowed":"pointer",
        fontSize:size==="xs"?10:size==="sm"?12:14,fontWeight:700,fontFamily:F,
        display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",
        opacity:disabled?0.45:1,boxShadow:v.shadow,
        width:full?"100%":"auto",justifyContent:full?"center":"flex-start",
        transition:"box-shadow 0.2s",...style}}>
      {children}
    </motion.button>
  );
};

const Input = ({style={},label,...p}) => (
  <div style={{display:"flex",flexDirection:"column",gap:6}}>
    {label && <div style={{fontSize:10,fontWeight:700,color:C.txt2,letterSpacing:1,textTransform:"uppercase"}}>{label}</div>}
    <input {...p} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,
      borderRadius:10,padding:"10px 14px",color:C.txt,fontFamily:F,fontSize:14,
      outline:"none",width:"100%",boxSizing:"border-box",transition:"border-color 0.2s",...style}}
      onFocus={e=>e.target.style.borderColor=C.indigo}
      onBlur={e=>e.target.style.borderColor=C.border}/>
  </div>
);

const ThemeSwitcher = ({theme,setTheme}) => {
  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <button onClick={() => setTheme(nextTheme)}
      style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 14px",
        borderRadius:14,border:`1px solid ${C.border}`,background:"rgba(255,255,255,0.05)",color:C.txt2,
        fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.2s"}}>
      {theme === "dark" ? <Sun size={14}/> : <Moon size={14}/>} {nextTheme === "dark" ? "Dark" : "Light"} Mode
    </button>
  );
};

const Select = ({children,label,style={},...p}) => (
  <div style={{display:"flex",flexDirection:"column",gap:6}}>
    {label && <div style={{fontSize:10,fontWeight:700,color:C.txt2,letterSpacing:1,textTransform:"uppercase"}}>{label}</div>}
    <select {...p} style={{background:C.surface2,border:`1px solid ${C.border}`,
      borderRadius:10,padding:"10px 14px",color:C.txt,fontFamily:F,fontSize:14,
      outline:"none",width:"100%",boxSizing:"border-box",...style}}>
      {children}
    </select>
  </div>
);

const StatCard = ({label,value,sub,color,icon,trend,delay=0,onClick,active}) => (
  <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay}}
    whileHover={{y:-4,scale:1.02}} whileTap={{scale:0.98}} onClick={onClick}
    style={{background:active?`linear-gradient(135deg,${color}18,${color}06)`:C.surface,
      border:`1px solid ${active?color+"44":C.border}`,borderRadius:18,padding:"20px 22px",
      cursor:onClick?"pointer":"default",transition:"all 0.22s",
      boxShadow:active?`0 8px 32px ${color}15`:"none"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
      <div style={{width:40,height:40,borderRadius:12,background:`${color}18`,border:`1px solid ${color}25`,
        display:"flex",alignItems:"center",justifyContent:"center",color,flexShrink:0}}>
        {icon}
      </div>
      {trend!==undefined && (
        <div style={{display:"flex",alignItems:"center",gap:3,fontSize:11,fontWeight:700,
          color:trend>0?C.emerald:trend<0?C.rose:C.txt2}}>
          {trend>0?<ArrowUp size={11}/>:trend<0?<ArrowDown size={11}/>:<Minus size={11}/>}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div style={{fontSize:30,fontWeight:900,color:C.txt,lineHeight:1,marginBottom:5,letterSpacing:-1}}>{value}</div>
    <div style={{fontSize:11,color,fontWeight:700,letterSpacing:0.5,marginBottom:2}}>{label}</div>
    {sub && <div style={{fontSize:11,color:C.txt2}}>{sub}</div>}
  </motion.div>
);

const SectionHeader = ({title,subtitle,icon,action}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:36,height:36,borderRadius:10,background:`${C.indigo}18`,
        display:"flex",alignItems:"center",justifyContent:"center",color:C.indigo}}>{icon}</div>
      <div>
        <div style={{fontSize:16,fontWeight:800,color:C.txt}}>{title}</div>
        {subtitle && <div style={{fontSize:12,color:C.txt2,marginTop:1}}>{subtitle}</div>}
      </div>
    </div>
    {action}
  </div>
);

const Toast = ({msg,type,onClose}) => (
  <motion.div initial={{opacity:0,x:60,scale:0.9}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0,x:60}}
    style={{position:"fixed",bottom:24,right:24,zIndex:9999,
      background:type==="success"?"rgba(16,185,129,0.12)":"rgba(244,63,94,0.12)",
      border:`1px solid ${type==="success"?C.emerald:C.rose}44`,
      borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,
      backdropFilter:"blur(20px)",maxWidth:380,fontFamily:F,boxShadow:"0 8px 40px rgba(0,0,0,0.4)"}}>
    {type==="success"?<CheckCircle size={16} color={C.emerald}/>:<AlertCircle size={16} color={C.rose}/>}
    <span style={{fontSize:13,color:C.txt,flex:1,lineHeight:1.4}}>{msg}</span>
    <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.txt2,display:"flex"}}><X size={13}/></button>
  </motion.div>
);

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg,type="error") => {
    setToast({msg,type,id:Date.now()});
    setTimeout(()=>setToast(null),4000);
  },[]);
  const el = toast && <AnimatePresence><Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/></AnimatePresence>;
  return [el, show];
}

// ══════════════════════════════════════════════════════
//  CHART COMPONENTS
// ══════════════════════════════════════════════════════
const RingChart = ({segments,size=100,stroke=11}) => {
  const r=(size-stroke*2)/2, cx=size/2, cy=size/2, circ=2*Math.PI*r;
  let offset=-Math.PI/2;
  const arcs=segments.map(s=>{const len=circ*s.pct;const arc={color:s.color,len,offset,r,cx,cy,circ};offset+=s.pct*2*Math.PI;return arc;});
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke}/>
      {arcs.map((a,i)=>(
        <circle key={i} cx={a.cx} cy={a.cy} r={a.r} fill="none" stroke={a.color} strokeWidth={stroke}
          strokeDasharray={`${a.len} ${a.circ}`} strokeLinecap="round"
          transform={`rotate(${(a.offset*180/Math.PI)+90} ${a.cx} ${a.cy})`}
          style={{transition:"stroke-dasharray 1s ease"}}/>
      ))}
    </svg>
  );
};

const MiniLineChart = ({data,color,height=52}) => {
  if(!data||!data.length) return null;
  const max=Math.max(...data,1);
  return (
    <div style={{height,width:"100%",position:"relative",overflow:"hidden"}}>
      <svg viewBox={`0 0 ${data.length-1} 10`} preserveAspectRatio="none" style={{width:"100%",height:"100%"}}>
        <defs>
          <linearGradient id={`g${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <polyline points={data.map((v,i)=>`${i},${10-(v/max)*9}`).join(" ")}
          fill="none" stroke={color} strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
        <polygon points={`0,10 ${data.map((v,i)=>`${i},${10-(v/max)*9}`).join(" ")} ${data.length-1},10`}
          fill={`url(#g${color.replace("#","")})`}/>
      </svg>
    </div>
  );
};

const BarGroup = ({data,maxVal,colors}) => (
  <div style={{display:"flex",gap:3,alignItems:"flex-end",height:60}}>
    {data.map((v,i)=>(
      <div key={i} title={v} style={{flex:1,minWidth:4,borderRadius:"3px 3px 0 0",
        height:`${Math.round((v/Math.max(maxVal,1))*100)}%`,background:colors?.[i]||C.indigo,
        transition:"height 0.8s cubic-bezier(0.34,1.56,0.64,1)",transitionDelay:`${i*0.04}s`,opacity:0.85}}/>
    ))}
  </div>
);

// ══════════════════════════════════════════════════════
//  EMAIL STATUS BADGE
// ══════════════════════════════════════════════════════
const EmailStatusBadge = ({status,count}) => {
  const S={
    sending:{label:"Sending…",color:C.amber,bg:"rgba(245,158,11,0.1)",icon:<Loader size={9} style={{animation:"spin 1s linear infinite"}}/>},
    sent:   {label:`Sent${count?` (${count})`:""}`,color:C.emerald,bg:"rgba(16,185,129,0.1)",icon:<CheckCircle size={9}/>},
    partial:{label:"Partial",color:C.orange,bg:"rgba(249,115,22,0.1)",icon:<AlertTriangle size={9}/>},
    failed: {label:"Failed",color:C.rose,bg:"rgba(244,63,94,0.1)",icon:<XCircle size={9}/>},
    pending:{label:"Pending",color:C.txt2,bg:"rgba(255,255,255,0.06)",icon:<Clock size={9}/>},
  };
  const s=S[status]||S.pending;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:20,
      fontSize:10,fontWeight:700,letterSpacing:0.3,background:s.bg,color:s.color,border:`1px solid ${s.color}25`}}>
      {s.icon}{s.label}
    </span>
  );
};

// ══════════════════════════════════════════════════════
//  SIDEBAR + TOPBAR
// ══════════════════════════════════════════════════════
const adminNav = [
  {key:"dashboard",   icon:<LayoutDashboard size={16}/>, label:"Dashboard"},
  {key:"attendance",  icon:<CheckSquare size={16}/>,     label:"Attendance"},
  {key:"students",    icon:<Users size={16}/>,           label:"Students"},
  {key:"classes",     icon:<BookOpen size={16}/>,        label:"Classes"},
  {key:"exams",       icon:<BookMarked size={16}/>,      label:"Exams"},
  {key:"grades",      icon:<GraduationCap size={16}/>,   label:"Grades"},
  {key:"leaves",      icon:<CalendarDays size={16}/>,    label:"Leaves"},
  {key:"fees",        icon:<CreditCard size={16}/>,      label:"Fees"},
  {key:"timetable",   icon:<Grid size={16}/>,            label:"Timetable"},
  {key:"announcements",icon:<Megaphone size={16}/>,      label:"Announcements"},
  {key:"parents",     icon:<MessageSquare size={16}/>,   label:"Parents"},
  {key:"notifications",icon:<Bell size={16}/>,           label:"Notifications"},
  {key:"analytics",   icon:<BarChart2 size={16}/>,       label:"Analytics"},
];

const studentNav = [
  {key:"dashboard",    icon:<LayoutDashboard size={16}/>, label:"Dashboard"},
  {key:"attendance",   icon:<CheckSquare size={16}/>,     label:"Attendance"},
  {key:"classes",      icon:<BookOpen size={16}/>,        label:"My Classes"},
  {key:"grades",       icon:<GraduationCap size={16}/>,   label:"My Grades"},
  {key:"leaves",       icon:<CalendarDays size={16}/>,    label:"Leaves"},
  {key:"fees",         icon:<CreditCard size={16}/>,      label:"My Fees"},
  {key:"timetable",    icon:<Grid size={16}/>,            label:"Timetable"},
  {key:"notifications",icon:<Bell size={16}/>,            label:"Notifications"},
  {key:"announcements",icon:<AlertCircle size={16}/>,     label:"Notices"},
];

const Sidebar = ({nav,active,setActive,user,onLogout,collapsed,setCollapsed}) => {
  const isMobile = () => typeof window !== "undefined" && window.innerWidth < 900;
  const closeOnMobile = () => { if (isMobile() && setCollapsed) setCollapsed(true); };
  return (
  <>
    <style>{`
      @media (max-width:900px){
        .appSidebar{position:fixed !important;top:0;left:0;z-index:300;width:230px !important;
          height:100vh;transform:translateX(-100%);transition:transform 0.28s ease;
          box-shadow:12px 0 40px rgba(0,0,0,0.4);}
        .appSidebar.is-open{transform:translateX(0);}
      }
    `}</style>
    {isMobile() && !collapsed && (
      <div onClick={closeOnMobile} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:299}}/>
    )}
    <div className={`appSidebar${!collapsed?" is-open":""}`} style={{width:collapsed?72:230,flexShrink:0,background:C.panel,borderRight:`1px solid ${C.border}`,
      display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,
      transition:"width 0.25s ease",overflow:"hidden"}}>
    <div style={{padding:"20px 18px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
          background:`linear-gradient(135deg,${C.indigo},${C.indigoLt})`,
          display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 16px ${C.indigo}40`}}>
          <img src="/dist/assets/acadexa-logo.png" alt="ACADEXA" style={{width:22,height:22,objectFit:"contain",filter:"brightness(1.2) drop-shadow(0 4px 8px rgba(0,0,0,0.25))"}} onError={(e)=>{e.currentTarget.style.display='none';}} />
          <GraduationCap size={18} color="#fff"/>
        </div>
        {!collapsed && <div><div style={{fontSize:14,fontWeight:900,color:C.txt,letterSpacing:-0.3}}>ACADEXA</div><div style={{fontSize:9,color:C.indigo,fontWeight:700,letterSpacing:1}}>by ASAD</div></div>}
      </div>
    </div>
    <nav style={{flex:1,padding:"12px 10px",overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
      {nav.map(item=>{
        const isActive=active===item.key;
        return (
          <motion.button key={item.key} onClick={()=>{setActive(item.key);closeOnMobile();}}
            whileHover={{x:2}} whileTap={{scale:0.97}}
            style={{display:"flex",alignItems:"center",gap:10,padding:"10px 10px",borderRadius:11,
              border:"none",cursor:"pointer",fontFamily:F,fontSize:13,fontWeight:isActive?700:500,
              background:isActive?`linear-gradient(135deg,${C.indigo}20,${C.indigo}08)`:"transparent",
              color:isActive?C.indigoLt:C.txt2,
              borderLeft:isActive?`2px solid ${C.indigo}`:"2px solid transparent",
              transition:"all 0.15s",width:"100%",justifyContent:collapsed?"center":"flex-start",
              paddingLeft:collapsed?10:isActive?10:12}}>
            <span style={{flexShrink:0,color:isActive?C.indigo:C.txt2}}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </motion.button>
        );
      })}
    </nav>
    <div style={{padding:"14px 12px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
      {!collapsed?(
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Avatar name={user?.name||"Admin"} size={34} color={C.indigo}/>
          <div style={{flex:1,overflow:"hidden"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user?.name||"Admin"}</div>
            <div style={{fontSize:10,color:C.txt2}}>{user?.role||"Administrator"}</div>
          </div>
        </div>
      ):<div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Avatar name={user?.name||"A"} size={32} color={C.indigo}/></div>}
      <button onClick={onLogout}
        style={{display:"flex",alignItems:"center",gap:7,padding:"8px 10px",borderRadius:9,
          border:"none",cursor:"pointer",fontFamily:F,fontSize:12,fontWeight:600,
          background:"rgba(244,63,94,0.08)",color:C.rose,width:"100%",
          justifyContent:collapsed?"center":"flex-start",transition:"background 0.2s"}}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(244,63,94,0.15)"}
        onMouseLeave={e=>e.currentTarget.style.background="rgba(244,63,94,0.08)"}>
        <LogOut size={13}/>{!collapsed&&"Sign Out"}
      </button>
    </div>
    </div>
  </>
  );
};

const TopBar = ({title,subtitle,actions,onToggleSidebar,theme}) => {
  const [time,setTime]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);
  return (
    <div style={{minHeight:62,background:theme === "light" ? "rgba(255,255,255,0.95)" : "rgba(5,6,15,0.95)",borderBottom:`1px solid ${C.border}`,
      color:C.txt,
      backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:40,
      display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",flexShrink:0,gap:10}}>
      <style>{`
        @media (max-width:640px){
          .topbarDateChip{display:none !important;}
          .topbarLogo{display:none !important;}
        }
      `}</style>
      <div style={{display:"flex",alignItems:"center",gap:14,minWidth:0}}>
        <button onClick={onToggleSidebar}
          style={{background:theme === "light" ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:8,padding:7,cursor:"pointer",color:C.txt2,display:"flex",flexShrink:0}}>
          <Menu size={15}/>
        </button>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <img className="topbarLogo" src="/assets/acadexa-logo.png" alt="ACADEXA" style={{width:28,height:28,objectFit:"contain",flexShrink:0,filter: theme === "light" ? "none" : "brightness(1.2) drop-shadow(0 4px 8px rgba(0,0,0,0.25))"}} onError={(e)=>{e.currentTarget.style.display='none';}} />
          <div style={{minWidth:0}}>
            <div style={{fontSize:16,fontWeight:800,color:C.txt,letterSpacing:-0.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
            {subtitle&&<div style={{fontSize:11,color:C.txt2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{subtitle}</div>}
          </div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0,padding:"10px 0"}}>
        <div className="topbarDateChip" style={{fontSize:12,color:C.txt2,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,
          borderRadius:8,padding:"5px 12px",letterSpacing:0.5,fontWeight:500,whiteSpace:"nowrap"}}>
          {time.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} · {time.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}
        </div>
        {actions}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  PORTAL — escapes full-screen overlays (drawers/modals) out of any
//  ancestor's z-indexed stacking context (e.g. page content wrappers),
//  so they always paint above sticky headers instead of underneath them.
// ══════════════════════════════════════════════════════
const Portal = ({children}) => typeof document !== "undefined" ? createPortal(children, document.body) : null;

// ══════════════════════════════════════════════════════
//  PHOTO MODAL
// ══════════════════════════════════════════════════════
const PhotoModal = ({student,onClose}) => (
  <Portal>
  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
    onClick={onClose}
    onKeyDown={(e) => e.key === 'Escape' && onClose()}
    tabIndex={0}
    style={{position:"fixed",inset:0,background:"rgba(2,3,12,0.95)",backdropFilter:"blur(20px)",zIndex:500,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"zoom-out",outline:"none"}}>
    <motion.div initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.8,opacity:0}}
      transition={{type:"spring",stiffness:260,damping:25}}
      onClick={e=>e.stopPropagation()}
      style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,maxWidth:480,width:"90%",cursor:"default"}}>
      <div style={{width:"100%",aspectRatio:"1",borderRadius:24,overflow:"hidden",border:`2px solid ${C.indigo}50`,boxShadow:`0 0 80px ${C.indigo}20`}}>
        {student.photo
          ?<img src={student.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={student.name}/>
          :<div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${C.indigo}22,${C.violet}11)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
            <div style={{fontSize:80,fontWeight:900,color:C.indigo,opacity:0.6}}>{student.name?student.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?"}</div>
            <div style={{fontSize:13,color:C.txt2}}>No photo uploaded</div>
          </div>}
      </div>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:800,color:C.txt}}>{student.name}</div>
        <div style={{fontSize:13,color:C.txt2,marginTop:3}}>Roll #{student.rollNo} · {student.email}</div>
      </div>
      <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 22px",cursor:"pointer",color:C.txt2,fontFamily:F,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:7}}><X size={13}/>Close</button>
    </motion.div>
  </motion.div>
  </Portal>
);

// ══════════════════════════════════════════════════════
//  STUDENT DRAWER — real history + real grades
// ══════════════════════════════════════════════════════
const StudentDrawer = ({student,api,onClose}) => {
  const [history,setHistory]=useState([]);
  const [grades,setGrades]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const sid=student._id||student.id;
    Promise.all([
      api.getHistory(sid,30).catch(()=>[]),
      api.getGrades(sid).catch(()=>[]),
    ]).then(([h,g])=>{setHistory(Array.isArray(h)?h:[]);setGrades(Array.isArray(g)?g:[]);})
      .finally(()=>setLoading(false));
  },[student._id]);

  const present=history.filter(d=>d.status==="present").length;
  const leave  =history.filter(d=>d.status==="leave").length;
  const absent =history.filter(d=>d.status==="absent").length;
  const attRate=Math.round(present/Math.max(history.length,1)*100);
  const gpa    =grades.length?(grades.reduce((s,g)=>s+(g.marks/g.maxMarks*4),0)/grades.length).toFixed(2):"N/A";
  const avgPct =grades.length?Math.round(grades.reduce((s,g)=>s+(g.marks/g.maxMarks*100),0)/grades.length):0;

  return (
    <Portal>
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      tabIndex={0}
      style={{position:"fixed",inset:0,background:"rgba(2,3,12,0.88)",backdropFilter:"blur(18px)",zIndex:200,display:"flex",justifyContent:"flex-end",outline:"none"}}
      onClick={onClose}>
      <motion.div initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}}
        transition={{type:"spring",stiffness:300,damping:32}}
        onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:500,height:"100%",background:C.bg2,borderLeft:`1px solid ${C.border}`,overflowY:"auto",display:"flex",flexDirection:"column",fontFamily:F}}>
        <div style={{padding:"0 24px 20px 24px",background:`linear-gradient(180deg,${C.indigo}0a 0%,transparent 100%)`,position:"sticky",top:0,zIndex:10,borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              <Avatar name={student.name} size={56} color={C.indigo} img={student.photo||undefined}/>
              <div>
                <div style={{fontSize:20,fontWeight:800,color:C.txt}}>{student.name}</div>
                <div style={{fontSize:12,color:C.txt2,marginBottom:6}}>{student.email}</div>
                <div style={{display:"flex",gap:6}}>
                  <Pill label={`Roll #${student.rollNo}`} color={C.indigo} bg="rgba(108,99,255,0.12)"/>
                  <Pill label="Active" color={C.emerald} bg="rgba(16,185,129,0.1)"/>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,borderRadius:9,padding:8,cursor:"pointer",color:C.txt2,display:"flex"}}><X size={15}/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:24}}>
            {[{label:"Attendance",value:`${attRate}%`,color:attRate>=75?C.emerald:C.rose},{label:"GPA",value:gpa,color:C.indigo},{label:"Avg Score",value:`${avgPct}%`,color:C.cyan},{label:"Streak",value:`${(()=>{let s=0;for(let i=history.length-1;i>=0;i--){if(history[i]?.status==="present")s++;else break;}return s;})()}d`,color:C.amber}].map(k=>(
              <div key={k.label} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 8px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:k.color,lineHeight:1}}>{k.value}</div>
                <div style={{fontSize:9,color:C.txt2,marginTop:4,fontWeight:700,letterSpacing:0.6}}>{k.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{padding:"0 24px 28px",display:"flex",flexDirection:"column",gap:16}}>
          {loading?<div style={{padding:40,textAlign:"center",color:C.txt2}}><Loader size={20} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 10px"}}/></div>:(
            <Card style={{padding:20}}>
              <div style={{fontSize:10,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:14}}>ATTENDANCE OVERVIEW</div>
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <RingChart size={90} stroke={10} segments={[
                    {color:C.emerald,pct:present/Math.max(history.length,1)},
                    {color:C.violet,pct:leave/Math.max(history.length,1)},
                    {color:C.rose,pct:absent/Math.max(history.length,1)},
                  ]}/>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:16,fontWeight:900,color:C.txt}}>{attRate}%</div>
                  </div>
                </div>
                <div style={{flex:1}}>
                  {[{col:C.emerald,l:"Present",v:present},{col:C.violet,l:"Leave",v:leave},{col:C.rose,l:"Absent",v:absent}].map(x=>(
                    <div key={x.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:C.txt2}}>
                        <div style={{width:8,height:8,borderRadius:2,background:x.col}}/>{x.l}
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{x.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{marginTop:16}}>
                <div style={{display:"flex",gap:2,alignItems:"flex-end",height:44}}>
                  {history.map((d,i)=>{
                    const col=d.status==="present"?C.emerald:d.status==="leave"?C.violet:d.status==="absent"?C.rose:"rgba(255,255,255,0.06)";
                    const h=d.status==="present"?"100%":d.status==="leave"?"60%":d.status==="absent"?"22%":"8%";
                    return <div key={i} title={`${d.date}: ${d.status}`} style={{flex:1,minWidth:2,borderRadius:2,height:h,background:col,transition:"height 0.5s ease",transitionDelay:`${i*0.01}s`}}/>;
                  })}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:9,color:C.dim}}><span>30d ago</span><span>Today</span></div>
              </div>
            </Card>
          )}

          {!loading && grades.length>0 && (
            <Card style={{padding:20}}>
              <div style={{fontSize:10,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:14}}>ACADEMIC PERFORMANCE</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {grades.map((g,i)=>{
                  const pct=Math.round(g.marks/g.maxMarks*100);
                  return (
                    <div key={i}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:13,color:C.txt,fontWeight:500}}>{g.subject}</span>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:11,color:C.txt2}}>{g.marks}/{g.maxMarks}</span>
                          <span style={{fontSize:12,fontWeight:800,color:gradeColor(pct)}}>{gradeLabel(pct)}</span>
                        </div>
                      </div>
                      <div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}>
                        <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:i*0.1+0.3,duration:0.6}}
                          style={{height:"100%",borderRadius:4,background:`linear-gradient(90deg,${gradeColor(pct)},${gradeColor(pct)}99)`}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          {!loading && grades.length===0 && (
            <Card style={{padding:20,textAlign:"center"}}><div style={{color:C.txt2,fontSize:13}}>No grade records yet</div></Card>
          )}

          {!loading && history.length>0 && (
            <Card style={{padding:20}}>
              <div style={{fontSize:10,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:12}}>RECENT ATTENDANCE</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {history.slice(-6).reverse().map((d,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"7px 0",borderBottom:i<5?`1px solid ${C.border}`:"none"}}>
                    <span style={{fontSize:12,color:C.txt2}}>{fmtShort(d.date)}</span>
                    <StatusPill status={d.status} size="xs"/>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </motion.div>
    </motion.div>
    </Portal>
  );
};

// ══════════════════════════════════════════════════════
//  CLASSES PAGE
// ══════════════════════════════════════════════════════
const ClassesPage = ({api,toast}) => {
  const [classes,setClasses]=useState([]);
  const [tomorrowClasses,setTomorrowClasses]=useState(null);
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [newCls,setNewCls]=useState({classCode:"",className:"",semester:1,teacher:"",scheduleDay:"Monday",scheduleTime:"",room:""});
  const [tomorrowForm,setTomorrowForm]=useState(null);

  useEffect(()=>{
    Promise.all([api.getClasses(),api.getTomorrowClasses()])
      .then(([c,t])=>{setClasses(Array.isArray(c)?c:[]);setTomorrowClasses(t);})
      .catch(()=>{setClasses([]);})
      .finally(()=>setLoading(false));
  },[]);

  const addClass=async()=>{
    if(!newCls.classCode||!newCls.className||!newCls.teacher||!newCls.scheduleTime||!newCls.scheduleDay||!newCls.room) return toast("Fill all fields");
    
    // Check if room is already booked at same time
    const conflict = classes.find(c => 
      c.room === newCls.room && 
      c.scheduleDay === newCls.scheduleDay && 
      c.scheduleTime === newCls.scheduleTime
    );
    
    if(conflict) {
      return toast(`Room ${newCls.room} is already booked at ${newCls.scheduleDay} ${newCls.scheduleTime}`,"error");
    }
    
    try{
      const result=await api.addClass({...newCls});
      setClasses(p=>[...p,result]);
      setNewCls({classCode:"",className:"",semester:1,teacher:"",scheduleDay:"Monday",scheduleTime:"",room:""});
      setShowAdd(false);
      toast("Class created!","success");
    }catch(e){toast(e.message);}
  };

  const setTomorrowDetails=async()=>{
    if(!tomorrowForm.classId||!tomorrowForm.topic) return toast("Class and topic required");
    try{
      await api.setTomorrowClass(tomorrowForm.classId,{
        topic:tomorrowForm.topic,
        materials:tomorrowForm.materials?.split(",").map(m=>m.trim())||[],
        assignment:tomorrowForm.assignment,
        deadline:tomorrowForm.deadline,
      });
      setTomorrowForm(null);
      setTomorrowClasses(p=>p?{...p,classes:p.classes.map(c=>c._id===tomorrowForm.classId?{...c,tomorrowTopic:tomorrowForm.topic,tomorrowAssignment:tomorrowForm.assignment}:c)}:p);
      toast("Tomorrow's class updated!","success");
    }catch(e){toast(e.message);}
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        <StatCard label="Total Classes" value={classes.length} color={C.indigo} icon={<BookOpen size={15}/>} delay={0}/>
        <StatCard label="Tomorrow's Classes" value={tomorrowClasses?.classes?.length||0} color={C.cyan} icon={<Calendar size={15}/>} delay={0.05}/>
        <StatCard label="Active Semesters" value={new Set(classes.map(c=>c.semester)).size} color={C.emerald} icon={<Layers size={15}/>} delay={0.1}/>
      </div>

      {tomorrowClasses && (
        <Card style={{padding:22,background:`linear-gradient(135deg,${C.cyan}12,${C.surface} 60%)`,borderColor:C.cyan+"44"}}>
          <SectionHeader title={`📅 Tomorrow's Classes (${tomorrowClasses.date})`} icon={<Calendar size={15}/>} subtitle={`${tomorrowClasses.day}`}/>
          {tomorrowClasses.classes.length===0?
            <div style={{padding:32,textAlign:"center",color:C.txt2}}>No classes scheduled for tomorrow</div>
            :(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
                {tomorrowClasses.classes.map(cls=>(
                  <motion.div key={cls._id} whileHover={{y:-2}}>
                    <Card style={{padding:16}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.txt,marginBottom:2}}>{cls.className}</div>
                      <div style={{fontSize:11,color:C.txt2,marginBottom:8}}>
                        📍 {cls.room} · {cls.scheduleTime} · {cls.teacher}
                      </div>
                      {cls.tomorrowTopic&&(
                        <div style={{background:`${C.cyan}15`,borderRadius:8,padding:10,marginBottom:8,fontSize:12,color:C.cyan,borderLeft:`3px solid ${C.cyan}`}}>
                          <strong>Topic:</strong> {cls.tomorrowTopic}
                        </div>
                      )}
                      {cls.tomorrowAssignment&&(
                        <div style={{background:`${C.amber}15`,borderRadius:8,padding:10,marginBottom:8,fontSize:12,color:C.amber,borderLeft:`3px solid ${C.amber}`}}>
                          <strong>Assignment:</strong> {cls.tomorrowAssignment}
                        </div>
                      )}
                      <Btn size="xs" onClick={()=>setTomorrowForm({classId:cls._id,topic:cls.tomorrowTopic||"",materials:(cls.tomorrowMaterials||[]).join(", "),assignment:cls.tomorrowAssignment||"",deadline:cls.tomorrowDeadline||""})} style={{width:"100%"}}>
                        <Edit3 size={11}/>Edit Tomorrow
                      </Btn>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
        </Card>
      )}

      <AnimatePresence>
        {tomorrowForm&&(
          <Portal>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setTomorrowForm(null)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <motion.div initial={{scale:0.9}} animate={{scale:1}} exit={{scale:0.9}} onClick={e=>e.stopPropagation()}
              style={{background:C.bg,borderRadius:16,padding:24,maxWidth:500,width:"100%",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:16,fontWeight:800,color:C.txt,marginBottom:16}}>📚 Manage Tomorrow's Class</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <Input label="Topic for Tomorrow" value={tomorrowForm.topic} onChange={e=>setTomorrowForm(p=>({...p,topic:e.target.value}))}/>
                <Input label="Materials (comma-separated URLs/names)" value={tomorrowForm.materials} onChange={e=>setTomorrowForm(p=>({...p,materials:e.target.value}))}/>
                <Input label="Assignment" value={tomorrowForm.assignment} onChange={e=>setTomorrowForm(p=>({...p,assignment:e.target.value}))}/>
                <Input label="Deadline (optional)" type="date" value={tomorrowForm.deadline} onChange={e=>setTomorrowForm(p=>({...p,deadline:e.target.value}))}/>
                <div style={{display:"flex",gap:10}}>
                  <Btn onClick={setTomorrowDetails} style={{flex:1}}>Save & Notify Students</Btn>
                  <Btn variant="ghost" onClick={()=>setTomorrowForm(null)} style={{flex:1}}>Cancel</Btn>
                </div>
              </div>
            </motion.div>
          </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      <Card style={{padding:22}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <SectionHeader title="All Classes" icon={<BookOpen size={15}/>} subtitle="Semester wise schedule"/>
          <Btn size="sm" onClick={()=>setShowAdd(p=>!p)}><PlusCircle size={13}/>{showAdd?"Cancel":"Add Class"}</Btn>
        </div>

        <AnimatePresence>
          {showAdd&&(
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden",marginBottom:16}}>
              <div style={{padding:14,background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${C.border}`}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:12}}>
                  <Input placeholder="Class Code *" value={newCls.classCode} onChange={e=>setNewCls(p=>({...p,classCode:e.target.value}))}/>
                  <Input placeholder="Class Name *" value={newCls.className} onChange={e=>setNewCls(p=>({...p,className:e.target.value}))}/>
                  <Input placeholder="Teacher *" value={newCls.teacher} onChange={e=>setNewCls(p=>({...p,teacher:e.target.value}))}/>
                  <Select value={newCls.scheduleDay} onChange={e=>setNewCls(p=>({...p,scheduleDay:e.target.value}))} style={{fontFamily:F,fontSize:13}}>
                    {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(d=><option key={d} value={d} style={{background:C.surface2}}>{d}</option>)}
                  </Select>
                  <Input type="time" placeholder="Start Time *" value={newCls.scheduleTime?.split("-")[0]||""} onChange={e=>setNewCls(p=>({...p,scheduleTime:e.target.value+(p.scheduleTime?.includes("-")?"-"+p.scheduleTime.split("-")[1]:"-09:30")}))}/>
                  <Input type="time" placeholder="End Time *" value={newCls.scheduleTime?.split("-")[1]||"09:30"} onChange={e=>setNewCls(p=>({...p,scheduleTime:(p.scheduleTime?.split("-")[0]||"08:00")+"-"+e.target.value}))}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10}}>
                  <Select value={newCls.room} onChange={e=>setNewCls(p=>({...p,room:e.target.value}))} style={{fontFamily:F,fontSize:13}}>
                    <option value="" style={{background:C.surface2}}>Select Room *</option>
                    {allRooms.map(r=><option key={r.code} value={r.code} style={{background:C.surface2}}>{r.label}</option>)}
                  </Select>
                  <Btn onClick={addClass}><CheckCircle size={14}/>Add Class</Btn>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading?<div style={{padding:40,textAlign:"center"}}><Loader size={18} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto"}}/></div>:classes.length===0?<div style={{padding:32,textAlign:"center",color:C.txt2}}>No classes yet</div>:(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[...new Set(classes.map(c=>c.semester))].sort().map(sem=>(
              <div key={sem}>
                <div style={{fontSize:12,fontWeight:700,color:C.indigo,letterSpacing:1,marginBottom:8,marginTop:sem>1?16:0}}>SEMESTER {sem}</div>
                {classes.filter(c=>c.semester===sem).map((c,i)=>(
                  <motion.div key={c._id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}>
                    <Card style={{padding:16,marginBottom:8}}>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr auto",alignItems:"center",gap:12}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{c.className}</div>
                          <div style={{fontSize:11,color:C.txt2}}>{c.classCode} · {c.teacher}</div>
                        </div>
                        <div style={{fontSize:12,color:C.txt2}}>{c.scheduleDay} {c.scheduleTime}</div>
                        <div style={{fontSize:12,color:C.txt2}}>📍 {c.room}</div>
                        <div style={{fontSize:12,color:C.cyan,fontWeight:600}}>{c.students?.length||0} students</div>
                        <StatusPill status={c.isActive?"approved":"pending"}/>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  NOTIFICATIONS PAGE
// ══════════════════════════════════════════════════════
const NotificationsPage = ({api,toast}) => {
  const [notifications,setNotifications]=useState([]);
  const [loading,setLoading]=useState(true);
  const [broadcasting,setBroadcasting]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({title:"",message:"",type:"notice",priority:"normal"});
  const [filter,setFilter]=useState("all");

  useEffect(()=>{
    api.getNotifications().then(n=>setNotifications(Array.isArray(n)?n:[])).catch(()=>setNotifications([])).finally(()=>setLoading(false));
  },[]);

  const sendBroadcast=async()=>{
    if(!form.title||!form.message) return toast("Title and message required");
    setBroadcasting(true);
    try{
      const result=await api.broadcastNotification({...form});
      toast(`Notification sent to ${result.count} students!`,"success");
      setForm({title:"",message:"",type:"notice",priority:"normal"});
      setShowForm(false);
    }catch(e){toast(e.message);}
    finally{setBroadcasting(false);}
  };

  const typeIcons={attendance:"📋",grade:"📊",fee:"💳",notice:"📢",assignment:"📝",exam:"📝",leave:"📅",announcement:"📣",alert:"⚠️"};
  const filtered=notifications.filter(n=>filter==="all"||n.type===filter);
  const unread=notifications.filter(n=>!n.isRead).length;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        <StatCard label="Total Notifications" value={notifications.length} color={C.indigo} icon={<Bell size={15}/>} delay={0}/>
        <StatCard label="Unread" value={unread} color={C.rose} icon={<AlertCircle size={15}/>} delay={0.05}/>
        <StatCard label="Today" value={notifications.filter(n=>n.createdAt&&new Date(n.createdAt).toDateString()===new Date().toDateString()).length} color={C.cyan} icon={<Calendar size={15}/>} delay={0.1}/>
        <StatCard label="High Priority" value={notifications.filter(n=>n.priority==="high").length} color={C.orange} icon={<AlertTriangle size={15}/>} delay={0.15}/>
      </div>

      <Card style={{padding:18}}>
        <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:3,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:3}}>
            {["all","attendance","grade","fee","notice","announcement","alert"].map(t=>(
              <button key={t} onClick={()=>setFilter(t)}
                style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",fontFamily:F,transition:"all 0.14s",background:filter===t?C.indigo:"transparent",color:filter===t?"#fff":C.txt2}}>
                {t==="all"?"All":t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
          <Btn size="sm" onClick={()=>setShowForm(p=>!p)}><Send size={13}/>{showForm?"Cancel":"Broadcast"}</Btn>
        </div>

        <AnimatePresence>
          {showForm&&(
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden"}}>
              <div style={{marginTop:14,padding:14,background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${C.border}`}}>
                <Input label="Title" placeholder="Notification title" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={{marginBottom:10}}/>
                <textarea value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} placeholder="Message for all students…" rows={3}
                  style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.txt,fontFamily:F,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",marginBottom:10,resize:"vertical"}}/>
                <div style={{display:"flex",gap:10,marginBottom:10}}>
                  <Select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} style={{flex:1}}>
                    {["notice","announcement","alert","attendance","grade","fee"].map(t=><option key={t} value={t} style={{background:C.surface2}}>{t}</option>)}
                  </Select>
                  <Select value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))} style={{flex:1}}>
                    {["low","normal","high"].map(p=><option key={p} value={p} style={{background:C.surface2}}>{p}</option>)}
                  </Select>
                </div>
                <Btn full onClick={sendBroadcast} disabled={broadcasting}>
                  {broadcasting?<Loader size={13} style={{animation:"spin 1s linear infinite"}}/>:<Send size={13}/>}
                  {broadcasting?"Sending...":"Send to All Students"}
                </Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {loading?<Card style={{padding:48,textAlign:"center"}}><Loader size={20} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto"}}/></Card>:filtered.length===0?<Card style={{padding:48,textAlign:"center"}}><Bell size={40} style={{color:C.txt2,opacity:0.15,display:"block",margin:"0 auto 12px"}}/><div style={{color:C.txt2,fontSize:14}}>No notifications</div></Card>:(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map((n,i)=>(
            <motion.div key={n._id||i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}>
              <Card hover style={{padding:16}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{fontSize:20}}>{typeIcons[n.type]||"📢"}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:4}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{n.title}</div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        {!n.isRead&&<div style={{width:8,height:8,borderRadius:"50%",background:C.cyan}}/>}
                        {n.priority==="high"&&<Pill label="Urgent" color={C.rose} bg="rgba(244,63,94,0.1)" size="xs"/>}
                      </div>
                    </div>
                    <div style={{fontSize:12,color:C.txt2,marginBottom:6}}>{n.message}</div>
                    <div style={{fontSize:10,color:C.dim}}>{n.sender} · {n.sentAt?new Date(n.sentAt).toLocaleString():""}</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  ADMIN OVERVIEW
// ══════════════════════════════════════════════════════
const AdminOverview = ({students,attendance,leaves,api,toast}) => {
  const [analytics,setAnalytics]=useState(null);
  const [annsPreview,setAnnsPreview]=useState([]);
  const [timeData,setTimeData]=useState(new Date());

  useEffect(()=>{
    const timer=setInterval(()=>setTimeData(new Date()),1000);
    api.getAnalytics().then(d=>setAnalytics(d)).catch(()=>{});
    api.getAnnouncements().then(d=>setAnnsPreview(Array.isArray(d)?d.slice(0,3):[])).catch(()=>{});
    return()=>clearInterval(timer);
  },[]);

  const totalStudents=students.length;
  const todayAtt=Object.values(attendance);
  const presentToday=todayAtt.filter(s=>s==="present").length;
  const leaveToday=todayAtt.filter(s=>s==="leave").length;
  const pendingLeaves=leaves.filter(l=>l.status==="pending").length;
  const attRate=totalStudents?Math.round(presentToday/totalStudents*100):0;
  const weekData=analytics?.weeklyAttendance||[65,71,68,79,74,82,attRate];
  const currentTime=timeData.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const currentDate=timeData.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"2-digit",year:"numeric"});

  return (
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
        style={{background:`linear-gradient(135deg,${C.indigo}18,${C.surface} 60%)`,border:`1px solid ${C.indigo}30`,borderRadius:20,padding:"24px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:`0 0 60px ${C.indigo}08`}}>
        <div>
          <div style={{fontSize:12,color:C.indigo,fontWeight:700,letterSpacing:1,marginBottom:4}}>GOOD {new Date().getHours()<12?"MORNING":"AFTERNOON"} ☀️</div>
          <div style={{fontSize:22,fontWeight:900,color:C.txt,letterSpacing:-0.5}}>Welcome back, Admin</div>
          <div style={{fontSize:13,color:C.txt2,marginTop:4}}>{currentDate}</div>
          <div style={{fontSize:11,color:C.dim,marginTop:2}}>Last updated: {currentTime}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:48,fontWeight:900,color:C.txt,lineHeight:1,letterSpacing:-2,fontFamily:FD}}>{analytics?.avgAttendance??attRate}<span style={{fontSize:24,color:C.emerald}}>%</span></div>
          <div style={{fontSize:11,color:C.emerald,fontWeight:700,letterSpacing:1}}>TODAY'S ATTENDANCE</div>
        </div>
      </motion.div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        <StatCard label="Total Students" value={totalStudents} color={C.indigo} icon={<Users size={16}/>} trend={analytics?.studentGrowth??5} delay={0.05}/>
        <StatCard label="Present Today" value={presentToday} color={C.emerald} icon={<UserCheck size={16}/>} sub={`of ${totalStudents}`} delay={0.1}/>
        <StatCard label="Leave Requests" value={pendingLeaves} color={C.amber} icon={<FileText size={16}/>} sub="pending review" delay={0.15}/>
        <StatCard label="Attendance Rate" value={`${analytics?.avgAttendance??attRate}%`} color={(analytics?.avgAttendance??attRate)>=75?C.emerald:C.rose} icon={<Activity size={16}/>} trend={analytics?.attendanceTrend??0} delay={0.2}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card style={{padding:22}}>
          <div style={{fontSize:11,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:4}}>WEEKLY ATTENDANCE TREND</div>
          <div style={{fontSize:28,fontWeight:900,color:C.txt,marginBottom:2}}>{weekData[weekData.length-1]}%</div>
          <MiniLineChart data={weekData} color={C.indigo} height={60}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:9,color:C.dim}}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Today"].map(d=><span key={d}>{d}</span>)}
          </div>
        </Card>
        <Card style={{padding:22}}>
          <div style={{fontSize:11,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:14}}>TODAY'S BREAKDOWN</div>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <div style={{position:"relative"}}>
              <RingChart size={88} stroke={10} segments={[
                {color:C.emerald,pct:presentToday/Math.max(totalStudents,1)},
                {color:C.violet,pct:leaveToday/Math.max(totalStudents,1)},
                {color:C.rose,pct:todayAtt.filter(s=>s==="absent").length/Math.max(totalStudents,1)},
              ]}/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:C.txt}}>{attRate}%</div>
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:9}}>
              {[{col:C.emerald,l:"Present",v:presentToday},{col:C.violet,l:"On Leave",v:leaveToday},{col:C.rose,l:"Absent",v:todayAtt.filter(s=>s==="absent").length},{col:C.txt2,l:"Unmarked",v:totalStudents-todayAtt.length}].map(x=>(
                <div key={x.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:C.txt2}}>
                    <div style={{width:8,height:8,borderRadius:2,background:x.col}}/>{x.l}
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:C.txt}}>{x.v}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {annsPreview.length>0 && (
        <Card style={{padding:22}}>
          <SectionHeader title="Recent Notices" icon={<Bell size={15}/>} subtitle="Latest announcements"/>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {annsPreview.map((a,i)=>(
              <div key={a._id||i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 14px",background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${C.border}`}}>
                <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:a.priority==="high"?`${C.rose}15`:`${C.amber}15`,display:"flex",alignItems:"center",justifyContent:"center",color:a.priority==="high"?C.rose:C.amber}}>
                  {a.priority==="high"?<AlertTriangle size={14}/>:<Info size={14}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.txt,marginBottom:2}}>{a.title}</div>
                  <div style={{fontSize:12,color:C.txt2,lineHeight:1.4,marginBottom:4}}>{(a.body||"").slice(0,80)}{a.body?.length>80?"…":""}</div>
                  <div style={{fontSize:10,color:C.dim}}>{fmt(a.date||a.createdAt)} · {a.createdAt?new Date(a.createdAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}):"N/A"} · {a.author}</div>
                </div>
                {a.priority==="high" && <Pill label="Urgent" color={C.rose} bg="rgba(244,63,94,0.1)" size="xs"/>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  ATTENDANCE PAGE
// ══════════════════════════════════════════════════════
const AttendancePage = ({students,attendance,setAttendance,api,toast}) => {
  const [date,setDate]=useState(today());
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");
  const [loading,setLoading]=useState(false);
  const [marking,setMarking]=useState(null);
  const [drawer,setDrawer]=useState(null);
  const [photoModal,setPhotoModal]=useState(null);

  const loadAtt=useCallback(async()=>{
    setLoading(true);
    try{setAttendance(await api.getAttendance(date));}
    catch(e){toast(e.message);}
    finally{setLoading(false);}
  },[date,api]);
  useEffect(()=>{loadAtt();},[date]);

  const getStatus=id=>attendance[id]||"unmarked";
  const mark=async(sid,status,e)=>{
    e.stopPropagation();setMarking(sid+status);
    try{await api.markAttendance({studentId:sid,date,status});setAttendance(p=>({...p,[sid]:status}));}
    catch(e){toast(e.message);}
    finally{setMarking(null);}
  };

  const stats=useMemo(()=>{
    const all=students.map(s=>getStatus(s._id));
    return{total:students.length,present:all.filter(s=>s==="present").length,absent:all.filter(s=>s==="absent").length,leave:all.filter(s=>s==="leave").length,unmarked:all.filter(s=>s==="unmarked").length};
  },[students,attendance]);

  const filtered=students.filter(s=>[s.name,s.email,s.rollNo].join(" ").toLowerCase().includes(query.toLowerCase())).filter(s=>filter==="all"?true:getStatus(s._id)===filter);

  const markAllPresent=async()=>{
    const unmarked=students.filter(s=>getStatus(s._id)==="unmarked");
    for(const s of unmarked){try{await api.markAttendance({studentId:s._id,date,status:"present"});setAttendance(p=>({...p,[s._id]:"present"}));}catch{}}
    toast(`Marked ${unmarked.length} students present`,"success");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
        {[{key:"all",label:"Total",v:stats.total,col:C.indigo,icon:<Users size={14}/>},{key:"present",label:"Present",v:stats.present,col:C.emerald,icon:<CheckCircle size={14}/>},{key:"absent",label:"Absent",v:stats.absent,col:C.rose,icon:<XCircle size={14}/>},{key:"leave",label:"On Leave",v:stats.leave,col:C.violet,icon:<CalendarDays size={14}/>},{key:"unmarked",label:"Unmarked",v:stats.unmarked,col:C.amber,icon:<Clock size={14}/>}].map((c,i)=>(
          <StatCard key={c.key} label={c.label} value={c.v} color={c.col} icon={c.icon} delay={i*0.05} onClick={()=>setFilter(filter===c.key?"all":c.key)} active={filter===c.key}/>
        ))}
      </div>
      <Card style={{padding:"14px 18px"}}>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:1,minWidth:180}}>
            <Search size={13} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.txt2,pointerEvents:"none"}}/>
            <Input placeholder="Search students…" value={query} onChange={e=>setQuery(e.target.value)} style={{paddingLeft:36}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px"}}>
            <Calendar size={12} color={C.indigo}/>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{background:"transparent",border:"none",outline:"none",color:C.txt,fontFamily:F,fontSize:13,cursor:"pointer"}}/>
          </div>
          <Btn variant="ghost" size="sm" onClick={loadAtt}><RefreshCw size={12}/>Refresh</Btn>
          {stats.unmarked>0&&<Btn variant="success" size="sm" onClick={markAllPresent}><CheckCircle size={12}/>Mark All Present ({stats.unmarked})</Btn>}
        </div>
      </Card>
      <Card style={{overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 0.7fr 1fr 180px",padding:"10px 20px",background:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`}}>
          {["Student","Email","Roll","Status","Actions"].map(h=><div key={h} style={{fontSize:9,fontWeight:700,color:C.dim,letterSpacing:1}}>{h.toUpperCase()}</div>)}
        </div>
        {loading&&<div style={{padding:48,textAlign:"center",color:C.txt2}}><Loader size={20} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 10px"}}/>Loading…</div>}
        <AnimatePresence>
          {filtered.map((s,i)=>{
            const status=getStatus(s._id);
            return (
              <motion.div key={s._id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={{opacity:0}} transition={{delay:i*0.025}}
                style={{display:"grid",gridTemplateColumns:"2fr 2fr 0.7fr 1fr 180px",padding:"12px 20px",borderBottom:`1px solid ${C.border}`,alignItems:"center",transition:"background 0.12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(108,99,255,0.04)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <motion.div whileHover={{scale:1.12}} whileTap={{scale:0.95}} onClick={()=>setPhotoModal(s)} style={{cursor:"zoom-in",flexShrink:0}} title="Click to view photo">
                    <Avatar name={s.name} size={33} color={C.indigo} img={s.photo||undefined}/>
                  </motion.div>
                  <div onClick={()=>setDrawer(s)} style={{cursor:"pointer"}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.txt}}>{s.name}</div>
                    <div style={{fontSize:10,color:C.txt2,display:"flex",alignItems:"center",gap:3,marginTop:1}}>View profile<ChevronRight size={9}/></div>
                  </div>
                </div>
                <div style={{fontSize:12,color:C.txt2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:10}}>{s.email}</div>
                <div style={{fontSize:13,fontWeight:700,color:C.txt}}>#{s.rollNo}</div>
                <StatusPill status={status}/>
                <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
                  {status==="leave"?(
                    <span style={{fontSize:10,color:C.violet,fontWeight:700,display:"flex",alignItems:"center",gap:3}}><CalendarDays size={10}/>Auto-Leave</span>
                  ):(
                    <>
                      <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}} onClick={e=>mark(s._id,"present",e)} disabled={!!marking}
                        style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:7,padding:"6px 10px",cursor:"pointer",color:C.emerald,display:"flex",alignItems:"center",gap:3,fontSize:11,fontWeight:700,fontFamily:F}}>
                        {marking===s._id+"present"?<Loader size={10} style={{animation:"spin 1s linear infinite"}}/>:<CheckCircle size={10}/>}P
                      </motion.button>
                      <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}} onClick={e=>mark(s._id,"absent",e)} disabled={!!marking}
                        style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.2)",borderRadius:7,padding:"6px 10px",cursor:"pointer",color:C.rose,display:"flex",alignItems:"center",gap:3,fontSize:11,fontWeight:700,fontFamily:F}}>
                        {marking===s._id+"absent"?<Loader size={10} style={{animation:"spin 1s linear infinite"}}/>:<XCircle size={10}/>}A
                      </motion.button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div style={{padding:"9px 20px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:11,color:C.dim}}>{filtered.length} of {students.length} students</span>
          <span style={{fontSize:11,color:C.dim}}>{stats.present}P · {stats.absent}A · {stats.leave}L · {stats.unmarked} unmarked</span>
        </div>
      </Card>
      <AnimatePresence>{drawer&&<StudentDrawer student={drawer} api={api} onClose={()=>setDrawer(null)}/>}</AnimatePresence>
      <AnimatePresence>{photoModal&&<PhotoModal student={photoModal} onClose={()=>setPhotoModal(null)}/>}</AnimatePresence>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  STUDENTS PAGE
// ══════════════════════════════════════════════════════
const StudentsPage = ({students,setStudents,api,toast}) => {
  const [query,setQuery]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [drawer,setDrawer]=useState(null);
  const [photoModal,setPhotoModal]=useState(null);
  const [uploadingId,setUploadingId]=useState(null);
  const [newS,setNewS]=useState({name:"",email:"",rollNo:"",password:"1234"});
  const [newPhotoFile,setNewPhotoFile]=useState(null);
  const [newPhotoPreview,setNewPhotoPreview]=useState(null);
  const filtered=students.filter(s=>[s.name,s.email,s.rollNo].join(" ").toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!showAdd) {
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
    }
  }, [showAdd]);

  const handlePhotoUpload=async(studentId,file)=>{
    if(!file) return;
    if(!file.type.startsWith("image/")) return toast("Please select an image file");
    if(file.size>2*1024*1024) return toast("Image must be under 2 MB");
    setUploadingId(studentId);
    try{
      const result=await api.uploadPhoto(studentId,file);
      setStudents(p=>p.map(s=>s._id===studentId?{...s,photo:result.student.photo}:s));
      toast("Photo uploaded!","success");
    }catch(e){toast(e.message);}
    finally{setUploadingId(null);}
  };

  const handleNewStudentPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Please select an image file");
    if (file.size > 2 * 1024 * 1024) return toast("Photo must be under 2 MB");
    setNewPhotoFile(file);
    setNewPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto=async(studentId,e)=>{
    e.stopPropagation();
    try{await api.deletePhoto(studentId);setStudents(p=>p.map(s=>s._id===studentId?{...s,photo:null}:s));toast("Photo removed","success");}
    catch(e){toast(e.message);}
  };

  const addStudent=async()=>{
    if(!newS.name||!newS.email||!newS.rollNo) return toast("All fields required");
    try{
      const s=await api.addStudent(newS);
      if(newPhotoFile){
        try{
          const result = await api.uploadPhoto(s._id,newPhotoFile);
          s.photo=result.student.photo;
        }catch(err){toast("Student added, but photo upload failed: "+err.message);}
      }
      setStudents(p=>[...p,s]);
      setNewS({name:"",email:"",rollNo:"",password:"1234"});
      setShowAdd(false);
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
      toast("Student added!","success");
    }catch(e){toast(e.message);}
  };

  const deleteStudent=async(id,e)=>{
    e.stopPropagation();
    if(!confirm("Delete this student permanently?")) return;
    try{await api.deleteStudent(id);setStudents(p=>p.filter(s=>s._id!==id));toast("Deleted","success");}
    catch(e){toast(e.message);}
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        <StatCard label="Total Enrolled" value={students.length} color={C.indigo} icon={<Users size={15}/>} delay={0}/>
        <StatCard label="With Photos" value={students.filter(s=>s.photo).length} color={C.emerald} icon={<Camera size={15}/>} delay={0.05}/>
        <StatCard label="New This Semester" value={Math.max(1,Math.round(students.length*0.18))} color={C.cyan} icon={<PlusCircle size={15}/>} delay={0.1}/>
      </div>
      <Card style={{padding:"14px 18px"}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{position:"relative",flex:1}}>
            <Search size={13} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.txt2,pointerEvents:"none"}}/>
            <Input placeholder="Search by name, email, roll no…" value={query} onChange={e=>setQuery(e.target.value)} style={{paddingLeft:36}}/>
          </div>
          <Btn size="sm" onClick={()=>setShowAdd(p=>!p)}><PlusCircle size={13}/>{showAdd?"Cancel":"Add Student"}</Btn>
        </div>
        <AnimatePresence>
          {showAdd&&(
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 0.7fr 0.7fr auto",gap:8,marginTop:14}}>
                {[["name","Full name"],["email","Email"],["rollNo","Roll No"],["password","Password"]].map(([f,ph])=>(
                  <Input key={f} placeholder={ph} value={newS[f]} onChange={e=>setNewS(p=>({...p,[f]:e.target.value}))}/>
                ))}
                <Btn onClick={addStudent}><CheckCircle size={14}/>Save</Btn>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0 0 0"}}>
                <label htmlFor="new-photo" style={{display:"inline-flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,fontWeight:700,color:C.indigo,background:`rgba(99,102,241,0.08)`,border:`1px solid ${C.indigo}22`,borderRadius:12,padding:"10px 14px"}}>
                  <Upload size={14}/> Upload profile photo
                </label>
                <input id="new-photo" type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleNewStudentPhoto(e.target.files[0])}/>
                {newPhotoPreview ? (
                  <div style={{width:56,height:56,borderRadius:16,overflow:"hidden",border:`1px solid ${C.border}`}}>
                    <img src={newPhotoPreview} alt="Preview" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                  </div>
                ) : (
                  <div style={{fontSize:12,color:C.txt2}}>Optional profile image</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        <AnimatePresence>
          {filtered.map((s,i)=>(
            <motion.div key={s._id} initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}} transition={{delay:i*0.04}}>
              <Card hover style={{padding:20}} onClick={()=>setDrawer(s)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div style={{display:"flex",gap:11,alignItems:"center"}}>
                    <div style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
                      <motion.div whileHover={{scale:1.05}} style={{cursor:"pointer"}} onClick={()=>setPhotoModal(s)}>
                        <Avatar name={s.name} size={50} color={C.indigo} img={s.photo||undefined}/>
                      </motion.div>
                      <label htmlFor={`photo-${s._id}`}
                        style={{position:"absolute",bottom:-4,right:-4,width:20,height:20,borderRadius:"50%",background:C.indigo,border:`2px solid ${C.bg}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:`0 2px 8px ${C.indigo}50`}}
                        title="Upload photo" onClick={e=>e.stopPropagation()}>
                        {uploadingId===s._id?<Loader size={9} color="#fff" style={{animation:"spin 1s linear infinite"}}/>:<Camera size={9} color="#fff"/>}
                      </label>
                      <input id={`photo-${s._id}`} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handlePhotoUpload(s._id,e.target.files[0])}/>
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.txt}}>{s.name}</div>
                      <div style={{fontSize:11,color:C.txt2}}>Roll #{s.rollNo}</div>
                      {s.photo&&<div style={{fontSize:9,color:C.emerald,marginTop:2,display:"flex",alignItems:"center",gap:3}}><CheckCircle size={8}/>Photo uploaded</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,flexDirection:"column",alignItems:"flex-end"}}>
                    <button onClick={e=>deleteStudent(s._id,e)} style={{background:"rgba(244,63,94,0.08)",border:"none",borderRadius:7,padding:"5px 7px",cursor:"pointer",color:C.rose,display:"flex"}}><Trash2 size={12}/></button>
                    {s.photo&&<button onClick={e=>removePhoto(s._id,e)} title="Remove photo" style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 6px",cursor:"pointer",color:C.txt2,display:"flex",fontSize:9,alignItems:"center",gap:3}}><X size={9}/>Photo</button>}
                  </div>
                </div>
                <div style={{fontSize:11,color:C.txt2,marginBottom:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.email}</div>
                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:9,padding:"9px 10px",border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10,color:C.txt2,marginBottom:2}}>PARENT</div>
                  <div style={{fontSize:13,fontWeight:600,color:C.txt}}>{s.parentName||"—"}</div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>{drawer&&<StudentDrawer student={drawer} api={api} onClose={()=>setDrawer(null)}/>}</AnimatePresence>
      <AnimatePresence>{photoModal&&<PhotoModal student={photoModal} onClose={()=>setPhotoModal(null)}/>}</AnimatePresence>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  EXAMS PAGE
// ══════════════════════════════════════════════════════
const ExamsPage = ({students,api,toast}) => {
  const [exams,setExams]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [adding,setAdding]=useState(false);
  const [newExam,setNewExam]=useState({name:"",subject:"",date:"",maxMarks:100,venue:""});

  useEffect(()=>{
    api.getExams().then(d=>setExams(Array.isArray(d)?d:[])).catch(()=>setExams([])).finally(()=>setLoading(false));
  },[]);

  const addExam=async()=>{
    if(!newExam.name||!newExam.subject||!newExam.date) return toast("Name, subject, date required");
    setAdding(true);
    const optimistic={_id:"tmp_"+Date.now(),...newExam,status:"upcoming",emailStatus:"sending"};
    setExams(p=>[optimistic,...p]);setShowAdd(false);setNewExam({name:"",subject:"",date:"",maxMarks:100,venue:""});
    try{
      const result=await api.addExam({...newExam});
      setExams(p=>p.map(e=>e._id===optimistic._id?{...(result.exam||result),emailStatus:result.emailStatus||"sent",emailCount:result.emailCount}:e));
      toast(`Exam added! Notified ${result.emailCount||0} students.`,"success");
    }catch(e){
      setExams(p=>p.map(e=>e._id===optimistic._id?{...e,emailStatus:"failed"}:e));
      toast(e.message);
    }finally{setAdding(false);}
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        <StatCard label="Total Exams" value={exams.length} color={C.cyan} icon={<BookMarked size={15}/>} delay={0}/>
        <StatCard label="Completed" value={exams.filter(e=>e.status==="completed").length} color={C.emerald} icon={<CheckCircle size={15}/>} delay={0.05}/>
        <StatCard label="Upcoming" value={exams.filter(e=>e.status==="upcoming").length} color={C.amber} icon={<Clock size={15}/>} delay={0.1}/>
      </div>
      <Card style={{padding:22}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <SectionHeader title="Exam Schedule" icon={<BookMarked size={15}/>} subtitle="All scheduled examinations"/>
          <Btn size="sm" onClick={()=>setShowAdd(p=>!p)}><PlusCircle size={13}/>{showAdd?"Cancel":"Add Exam"}</Btn>
        </div>
        <AnimatePresence>
          {showAdd&&(
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden",marginBottom:16}}>
              <div style={{display:"flex",flexDirection:"column",gap:10,padding:"16px",background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${C.border}`}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 0.5fr",gap:8}}>
                  <Input placeholder="Exam name" value={newExam.name} onChange={e=>setNewExam(p=>({...p,name:e.target.value}))}/>
                  <Input placeholder="Subject" value={newExam.subject} onChange={e=>setNewExam(p=>({...p,subject:e.target.value}))}/>
                  <Input type="date" value={newExam.date} onChange={e=>setNewExam(p=>({...p,date:e.target.value}))}/>
                  <Input placeholder="Max marks" type="number" value={newExam.maxMarks} onChange={e=>setNewExam(p=>({...p,maxMarks:e.target.value}))}/>
                </div>
                <Input placeholder="Venue (optional)" value={newExam.venue} onChange={e=>setNewExam(p=>({...p,venue:e.target.value}))}/>
                {newExam.name&&(
                  <div style={{background:"rgba(34,211,238,0.06)",border:"1px solid rgba(34,211,238,0.18)",borderRadius:9,padding:"9px 13px",display:"flex",gap:8,alignItems:"center"}}>
                    <Globe size={11} color={C.cyan}/>
                    <span style={{fontSize:11,color:C.txt2}}>Will email <strong style={{color:C.txt}}>{students.length} students</strong> about this exam</span>
                  </div>
                )}
                <Btn onClick={addExam} disabled={adding} style={{width:"fit-content"}}>
                  {adding?<Loader size={13} style={{animation:"spin 1s linear infinite"}}/>:<CheckCircle size={14}/>}Save & Notify Students
                </Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {loading&&<div style={{padding:40,textAlign:"center"}}><Loader size={18} color={C.cyan} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 10px"}}/></div>}
        {!loading&&exams.length===0&&<div style={{padding:40,textAlign:"center",color:C.txt2,fontSize:13}}>No exams yet. Add one above.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {exams.map((exam,i)=>(
            <motion.div key={exam._id||exam.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",background:"rgba(255,255,255,0.02)",borderRadius:14,border:`1px solid ${C.border}`,transition:"border-color 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.borderMd}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:42,height:42,borderRadius:12,background:exam.status==="completed"?`${C.emerald}15`:`${C.amber}15`,display:"flex",alignItems:"center",justifyContent:"center",color:exam.status==="completed"?C.emerald:C.amber}}>
                    {exam.status==="completed"?<CheckCircle size={17}/>:<Clock size={17}/>}
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.txt}}>{exam.name}</div>
                    <div style={{fontSize:12,color:C.txt2,display:"flex",alignItems:"center",gap:8,marginTop:2}}>
                      <span style={{color:subjectColors[exam.subject]||C.indigo,fontWeight:600}}>{exam.subject}</span>
                      <span>·</span><span>{fmt(exam.date)}</span>
                      {exam.venue&&<><span>·</span><span>📍 {exam.venue}</span></>}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  {exam.emailStatus&&<EmailStatusBadge status={exam.emailStatus} count={exam.emailCount}/>}
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:C.txt2,marginBottom:2}}>Max Marks</div>
                    <div style={{fontSize:15,fontWeight:800,color:C.txt}}>{exam.maxMarks}</div>
                  </div>
                  <StatusPill status={exam.status==="completed"?"approved":"pending"}/>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  GRADES PAGE
// ══════════════════════════════════════════════════════
const GradesPage = ({students,api,toast,isAdmin=true}) => {
  const [selected,setSelected]=useState(students[0]?._id||"");
  const [grades,setGrades]=useState([]);
  const [loading,setLoading]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [newGrade,setNewGrade]=useState({subject:"",examName:"",marks:"",maxMarks:100});

  useEffect(()=>{
    if(!selected) return;
    setLoading(true);
    api.getGrades(selected).then(d=>setGrades(Array.isArray(d)?d:[])).catch(()=>setGrades([])).finally(()=>setLoading(false));
  },[selected]);

  const student=students.find(s=>s._id===selected);
  const avgPct=grades.length?Math.round(grades.reduce((s,g)=>s+(g.marks/g.maxMarks*100),0)/grades.length):0;

  const saveGrade=async()=>{
    if(!newGrade.subject||!newGrade.examName||!newGrade.marks) return toast("Fill all fields");
    try{
      const result=await api.addGrade({...newGrade,studentId:selected});
      setGrades(p=>[...p,result.grade||result]);
      setNewGrade({subject:"",examName:"",marks:"",maxMarks:100});
      setShowAdd(false);
      toast("Grade saved!","success");
    }catch(e){toast(e.message);}
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <StatCard label="Subjects Recorded" value={grades.length} color={C.indigo} icon={<BookMarked size={15}/>} delay={0}/>
        <StatCard label="Average Score" value={`${avgPct}%`} color={gradeColor(avgPct)} icon={<TrendingUp size={15}/>} delay={0.05}/>
        <StatCard label="Overall Grade" value={gradeLabel(avgPct)} color={gradeColor(avgPct)} icon={<Award size={15}/>} delay={0.1}/>
      </div>
      <Card style={{padding:22}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <SectionHeader title="Grade Report" icon={<GraduationCap size={15}/>} subtitle="Academic performance tracking"/>
          <div style={{display:"flex",gap:10}}>
            {isAdmin&&students.length>1&&(
              <select value={selected} onChange={e=>setSelected(e.target.value)}
                style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",color:C.txt,fontFamily:F,fontSize:13,outline:"none"}}>
                {students.map(s=><option key={s._id} value={s._id} style={{background:C.surface2}}>{s.name} (#{s.rollNo})</option>)}
              </select>
            )}
            {isAdmin&&<Btn size="sm" onClick={()=>setShowAdd(p=>!p)}><PlusCircle size={13}/>Add Grade</Btn>}
          </div>
        </div>
        {student&&(
          <div style={{display:"flex",gap:16,alignItems:"center",padding:"16px 18px",background:`linear-gradient(135deg,${C.indigo}12,rgba(255,255,255,0.02))`,borderRadius:14,border:`1px solid ${C.indigo}25`,marginBottom:18}}>
            <Avatar name={student.name} size={44} color={C.indigo} img={student.photo||undefined}/>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:C.txt}}>{student.name}</div>
              <div style={{fontSize:12,color:C.txt2}}>Roll #{student.rollNo}</div>
            </div>
            <div style={{textAlign:"center",padding:"0 20px"}}>
              <div style={{fontSize:32,fontWeight:900,color:gradeColor(avgPct),letterSpacing:-1}}>{gradeLabel(avgPct)}</div>
              <div style={{fontSize:10,color:C.txt2,fontWeight:700,letterSpacing:0.5}}>OVERALL GRADE</div>
            </div>
            <div style={{textAlign:"center",padding:"0 20px",borderLeft:`1px solid ${C.border}`}}>
              <div style={{fontSize:28,fontWeight:900,color:C.txt}}>{avgPct}%</div>
              <div style={{fontSize:10,color:C.txt2,fontWeight:700,letterSpacing:0.5}}>AVERAGE</div>
            </div>
          </div>
        )}
        <AnimatePresence>
          {showAdd&&(
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden",marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 0.5fr 0.5fr auto",gap:8,padding:"14px",background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${C.border}`}}>
                <Input placeholder="Subject" value={newGrade.subject} onChange={e=>setNewGrade(p=>({...p,subject:e.target.value}))}/>
                <Input placeholder="Exam name" value={newGrade.examName} onChange={e=>setNewGrade(p=>({...p,examName:e.target.value}))}/>
                <Input type="number" placeholder="Marks" value={newGrade.marks} onChange={e=>setNewGrade(p=>({...p,marks:e.target.value}))}/>
                <Input type="number" placeholder="Max" value={newGrade.maxMarks} onChange={e=>setNewGrade(p=>({...p,maxMarks:e.target.value}))}/>
                <Btn onClick={saveGrade}><CheckCircle size={14}/>Save</Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {loading&&<div style={{padding:32,textAlign:"center"}}><Loader size={18} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto"}}/></div>}
        {!loading&&grades.length===0&&<div style={{padding:32,textAlign:"center",color:C.txt2,fontSize:13}}>No grades recorded yet.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {grades.map((g,i)=>{
            const pct=Math.round(g.marks/g.maxMarks*100);
            return (
              <motion.div key={g._id||i} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr",alignItems:"center",gap:10,padding:"14px 16px",background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{g.subject}</div>
                    <div style={{fontSize:11,color:C.txt2}}>{g.examName}</div>
                  </div>
                  <div style={{fontSize:12,color:C.txt2}}>{g.date?fmt(g.date):""}</div>
                  <div style={{fontSize:14,fontWeight:700,color:C.txt}}>{g.marks}/{g.maxMarks}</div>
                  <div>
                    <div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}>
                      <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:i*0.1+0.3,duration:0.6}}
                        style={{height:"100%",borderRadius:4,background:`linear-gradient(90deg,${gradeColor(pct)},${gradeColor(pct)}99)`}}/>
                    </div>
                    <div style={{fontSize:10,color:C.txt2,marginTop:3}}>{pct}%</div>
                  </div>
                  <div style={{textAlign:"center"}}><span style={{fontSize:18,fontWeight:900,color:gradeColor(pct)}}>{gradeLabel(pct)}</span></div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  FEES PAGE
// ══════════════════════════════════════════════════════
const FeesPage = ({students,api,toast,studentId=null,isAdmin=true}) => {
  const [fees,setFees]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [newFee,setNewFee]=useState({title:"",amount:"",due:"",category:"tuition"});
  const [paying,setPaying]=useState(null);

  useEffect(()=>{
    api.getFees(studentId).then(d=>setFees(Array.isArray(d)?d:[])).catch(()=>setFees([])).finally(()=>setLoading(false));
  },[studentId]);

  const payFee=async(id)=>{
    setPaying(id);
    try{const updated=await api.payFee(id);setFees(p=>p.map(f=>f._id===id?{...f,...(updated.fee||updated),status:"paid"}:f));toast("Fee marked as paid!","success");}
    catch(e){toast(e.message);}
    finally{setPaying(null);}
  };

  const addFee=async()=>{
    if(!newFee.title||!newFee.amount||!newFee.due) return toast("Title, amount, due date required");
    try{
      const result=await api.addFee({...newFee,studentId:studentId||undefined});
      setFees(p=>[...p,result.fee||result]);
      setNewFee({title:"",amount:"",due:"",category:"tuition"});
      setShowAdd(false);
      toast("Fee added!","success");
    }catch(e){toast(e.message);}
  };

  const total=fees.reduce((s,f)=>s+(Number(f.amount)||0),0);
  const paid=fees.filter(f=>f.status==="paid").reduce((s,f)=>s+(Number(f.amount)||0),0);
  const unpaid=fees.filter(f=>f.status!=="paid").reduce((s,f)=>s+(Number(f.amount)||0),0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        <StatCard label="Total Fees" value={`₨${(total/1000).toFixed(0)}K`} color={C.indigo} icon={<CreditCard size={15}/>} delay={0}/>
        <StatCard label="Paid" value={`₨${(paid/1000).toFixed(0)}K`} color={C.emerald} icon={<CheckCircle size={15}/>} delay={0.05}/>
        <StatCard label="Unpaid" value={`₨${(unpaid/1000).toFixed(0)}K`} color={C.rose} icon={<XCircle size={15}/>} delay={0.1}/>
        <StatCard label="Overdue" value={fees.filter(f=>f.status==="overdue").length} color={C.orange} icon={<AlertTriangle size={15}/>} delay={0.15}/>
      </div>
      <Card style={{padding:22}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <SectionHeader title="Fee Records" icon={<CreditCard size={15}/>} subtitle="All fee transactions"/>
          {isAdmin&&<Btn size="sm" onClick={()=>setShowAdd(p=>!p)}><PlusCircle size={13}/>{showAdd?"Cancel":"Add Fee"}</Btn>}
        </div>
        <AnimatePresence>
          {showAdd&&(
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden",marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 0.7fr 0.8fr 0.8fr auto",gap:8,padding:"14px",background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${C.border}`}}>
                <Input placeholder="Fee title" value={newFee.title} onChange={e=>setNewFee(p=>({...p,title:e.target.value}))}/>
                <Input type="number" placeholder="Amount ₨" value={newFee.amount} onChange={e=>setNewFee(p=>({...p,amount:e.target.value}))}/>
                <Input type="date" value={newFee.due} onChange={e=>setNewFee(p=>({...p,due:e.target.value}))}/>
                <Select value={newFee.category} onChange={e=>setNewFee(p=>({...p,category:e.target.value}))}>
                  {["tuition","lab","library","exam","other"].map(c=><option key={c} value={c} style={{background:C.surface2}}>{c}</option>)}
                </Select>
                <Btn onClick={addFee}><CheckCircle size={14}/>Save</Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {loading&&<div style={{padding:40,textAlign:"center"}}><Loader size={18} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto"}}/></div>}
        {!loading&&fees.length===0&&<div style={{padding:32,textAlign:"center",color:C.txt2,fontSize:13}}>No fee records found.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {fees.map((fee,i)=>(
            <motion.div key={fee._id||i} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",background:"rgba(255,255,255,0.02)",borderRadius:14,border:`1px solid ${C.border}`,transition:"border-color 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.borderMd}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:42,height:42,borderRadius:12,flexShrink:0,background:fee.status==="paid"?`${C.emerald}15`:fee.status==="overdue"?`${C.orange}15`:`${C.rose}15`,display:"flex",alignItems:"center",justifyContent:"center",color:fee.status==="paid"?C.emerald:fee.status==="overdue"?C.orange:C.rose}}>
                    <CreditCard size={17}/>
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.txt}}>{fee.title}</div>
                    <div style={{fontSize:12,color:C.txt2,marginTop:2}}>
                      Due: {fmt(fee.due||fee.dueDate)} 
                      {fee.status==="paid"&&fee.paidOn&&<span style={{color:C.emerald}}> · Paid: {fmt(fee.paidOn)} on {new Date(fee.paidOn).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</span>}
                      {fee.status==="overdue"&&<span style={{color:C.orange}}> · Overdue by {Math.ceil((new Date()-new Date(fee.due||fee.dueDate))/86400000)} days</span>}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:800,color:C.txt}}>₨{Number(fee.amount).toLocaleString()}</div>
                    <div style={{fontSize:10,color:C.txt2,textTransform:"uppercase",letterSpacing:0.5}}>{fee.category}</div>
                  </div>
                  <StatusPill status={fee.status||"unpaid"}/>
                  {fee.status!=="paid"&&(
                    <Btn variant="success" size="xs" disabled={paying===fee._id} onClick={()=>payFee(fee._id)}>
                      {paying===fee._id?<Loader size={11} style={{animation:"spin 1s linear infinite"}}/>:<CheckCircle size={11}/>}Pay
                    </Btn>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  TIMETABLE PAGE
// ══════════════════════════════════════════════════════
const TimetablePage = ({api,toast,isAdmin=false}) => {
  const [timetable,setTimetable]=useState({});
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [newCls,setNewCls]=useState({day:"Monday",time:"",subject:"",teacher:"",room:""});
  const days=["Monday","Tuesday","Wednesday","Thursday","Friday"];
  const todayName=new Date().toLocaleDateString("en-US",{weekday:"long"});
  const [activeDay,setActiveDay]=useState(days.includes(todayName)?todayName:days[0]);

  useEffect(()=>{
    api.getTimetable()
      .then(d=>{
        if(Array.isArray(d)){
          const obj={};
          d.forEach(cls=>{if(!obj[cls.day])obj[cls.day]=[];obj[cls.day].push(cls);});
          setTimetable(obj);
        } else {setTimetable(d||{});}
      })
      .catch(()=>setTimetable({}))
      .finally(()=>setLoading(false));
  },[]);

  const addClass=async()=>{
    if(!newCls.day||!newCls.time||!newCls.subject||!newCls.teacher) return toast("Day, time, subject, teacher required");
    try{
      const result=await api.addTimetable({...newCls});
      const entry=result.entry||result;
      setTimetable(p=>({...p,[newCls.day]:[...(p[newCls.day]||[]),entry]}));
      setNewCls({day:"Monday",time:"",subject:"",teacher:"",room:""});
      setShowAdd(false);
      toast("Class added!","success");
    }catch(e){toast(e.message);}
  };

  const schedule=timetable[activeDay]||[];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <Card style={{padding:22}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <SectionHeader title="Class Timetable" icon={<Grid size={15}/>} subtitle="Weekly schedule"/>
          {isAdmin&&<Btn size="sm" onClick={()=>setShowAdd(p=>!p)}><PlusCircle size={13}/>{showAdd?"Cancel":"Add Class"}</Btn>}
        </div>
        <AnimatePresence>
          {showAdd&&(
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden",marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"0.7fr 0.7fr 1fr 1fr 0.7fr auto",gap:8,padding:"14px",background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${C.border}`}}>
                <Select value={newCls.day} onChange={e=>setNewCls(p=>({...p,day:e.target.value}))}>
                  {days.map(d=><option key={d} value={d} style={{background:C.surface2}}>{d}</option>)}
                </Select>
                <Input placeholder="08:00-09:30" value={newCls.time} onChange={e=>setNewCls(p=>({...p,time:e.target.value}))}/>
                <Input placeholder="Subject" value={newCls.subject} onChange={e=>setNewCls(p=>({...p,subject:e.target.value}))}/>
                <Input placeholder="Teacher" value={newCls.teacher} onChange={e=>setNewCls(p=>({...p,teacher:e.target.value}))}/>
                <Input placeholder="Room" value={newCls.room} onChange={e=>setNewCls(p=>({...p,room:e.target.value}))}/>
                <Btn onClick={addClass}><CheckCircle size={14}/>Save</Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{display:"flex",gap:4,marginBottom:20,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:12,padding:4,width:"fit-content"}}>
          {days.map(d=>(
            <button key={d} onClick={()=>setActiveDay(d)}
              style={{padding:"8px 16px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",fontFamily:F,transition:"all 0.15s",
                background:activeDay===d?C.indigo:"transparent",
                color:activeDay===d?"#fff":d===todayName?C.indigoLt:C.txt2}}>
              {d.slice(0,3)}
              {d===todayName&&<span style={{width:4,height:4,borderRadius:"50%",background:C.cyan,display:"inline-block",marginLeft:4,verticalAlign:"middle"}}/>}
            </button>
          ))}
        </div>
        {loading&&<div style={{padding:32,textAlign:"center"}}><Loader size={18} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto"}}/></div>}
        {!loading&&schedule.length===0&&<div style={{textAlign:"center",color:C.txt2,padding:32,fontSize:13}}>No classes scheduled for {activeDay}.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {schedule.map((cls,i)=>(
            <motion.div key={i} initial={{opacity:0,x:-14}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}}>
              <div style={{display:"flex",gap:16,alignItems:"stretch",padding:"14px 18px",background:"rgba(255,255,255,0.02)",borderRadius:14,border:`1px solid ${C.border}`,borderLeft:`3px solid ${subjectColors[cls.subject]||C.indigo}`}}>
                <div style={{width:80,flexShrink:0,display:"flex",flexDirection:"column",justifyContent:"center"}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{(cls.time||"").split("-")[0]}</div>
                  <div style={{fontSize:10,color:C.txt2}}>{(cls.time||"").split("-")[1]}</div>
                </div>
                <div style={{width:1,background:C.border,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:subjectColors[cls.subject]||C.indigo,marginBottom:4}}>{cls.subject}</div>
                  <div style={{fontSize:12,color:C.txt2,display:"flex",gap:12}}>
                    <span style={{display:"flex",alignItems:"center",gap:4}}><User size={10}/>{cls.teacher}</span>
                    {cls.room&&<span style={{display:"flex",alignItems:"center",gap:4}}><Hash size={10}/>{cls.room}</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  ANNOUNCEMENTS PAGE
// ══════════════════════════════════════════════════════
const AnnouncementsPage = ({isAdmin,api,toast}) => {
  const [anns,setAnns]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [posting,setPosting]=useState(false);
  const [newAnn,setNewAnn]=useState({title:"",body:"",category:"general",priority:"normal"});
  const [filter,setFilter]=useState("all");

  useEffect(()=>{
    api.getAnnouncements().then(d=>setAnns(Array.isArray(d)?d:[])).catch(()=>setAnns([])).finally(()=>setLoading(false));
  },[]);

  const filtered=anns.filter(a=>filter==="all"||a.category===filter||a.priority===filter);
  const catColors={exam:C.cyan,fee:C.rose,event:C.emerald,general:C.txt2};

  const post=async()=>{
    if(!newAnn.title||!newAnn.body) return toast("Title and body required");
    setPosting(true);
    const optimistic={_id:"tmp_"+Date.now(),...newAnn,date:today(),author:"Admin",emailStatus:"sending"};
    setAnns(p=>[optimistic,...p]);setShowAdd(false);setNewAnn({title:"",body:"",category:"general",priority:"normal"});
    try{
      const result=await api.addAnnouncement({...newAnn,author:"Admin"});
      setAnns(p=>p.map(a=>a._id===optimistic._id?{...result,emailStatus:result.emailStatus||"sent"}:a));
      toast("Announcement posted!","success");
    }catch(e){
      setAnns(p=>p.map(a=>a._id===optimistic._id?{...a,emailStatus:"failed"}:a));
      toast(e.message);
    }finally{setPosting(false);}
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {isAdmin&&(
        <Card style={{padding:"14px 18px"}}>
          <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:4,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:3}}>
              {["all","exam","fee","event","general"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",fontFamily:F,transition:"all 0.14s",background:filter===f?C.indigo:"transparent",color:filter===f?"#fff":C.txt2}}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
            <Btn size="sm" onClick={()=>setShowAdd(p=>!p)}><PlusCircle size={13}/>{showAdd?"Cancel":"New Announcement"}</Btn>
          </div>
          <AnimatePresence>
            {showAdd&&(
              <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden"}}>
                <div style={{display:"flex",flexDirection:"column",gap:10,padding:"14px",marginTop:12,background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${C.border}`}}>
                  <Input placeholder="Title" value={newAnn.title} onChange={e=>setNewAnn(p=>({...p,title:e.target.value}))}/>
                  <textarea value={newAnn.body} onChange={e=>setNewAnn(p=>({...p,body:e.target.value}))} placeholder="Announcement body…" rows={3}
                    style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.txt,fontFamily:F,fontSize:14,outline:"none",resize:"vertical"}}/>
                  {newAnn.title&&(
                    <div style={{background:"rgba(34,211,238,0.06)",border:"1px solid rgba(34,211,238,0.2)",borderRadius:9,padding:"9px 13px",display:"flex",gap:8,alignItems:"center"}}>
                      <Globe size={11} color={C.cyan}/>
                      <div style={{fontSize:11,color:C.txt2}}>Email subject: <strong style={{color:C.txt}}>{newAnn.priority==="high"?"🚨 URGENT: ":"📢 "}{newAnn.title}</strong></div>
                    </div>
                  )}
                  <div style={{display:"flex",gap:8}}>
                    <Select value={newAnn.category} onChange={e=>setNewAnn(p=>({...p,category:e.target.value}))}>
                      {["general","exam","fee","event"].map(c=><option key={c} value={c} style={{background:C.surface2}}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </Select>
                    <Select value={newAnn.priority} onChange={e=>setNewAnn(p=>({...p,priority:e.target.value}))}>
                      {["normal","high","low"].map(p=><option key={p} value={p} style={{background:C.surface2}}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                    </Select>
                    <Btn onClick={post} disabled={posting}>{posting?<Loader size={13} style={{animation:"spin 1s linear infinite"}}/>:<Send size={13}/>}Post & Email</Btn>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}
      {loading&&<Card style={{padding:48,textAlign:"center"}}><Loader size={20} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 10px"}}/></Card>}
      {!loading&&filtered.length===0&&<Card style={{padding:48,textAlign:"center"}}><Bell size={32} style={{color:C.txt2,opacity:0.2,display:"block",margin:"0 auto 12px"}}/><div style={{color:C.txt2,fontSize:14}}>No announcements yet</div></Card>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <AnimatePresence>
          {filtered.map((a,i)=>(
            <motion.div key={a._id||a.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:i*0.05}}>
              <Card hover style={{padding:22}}>
                <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                  <div style={{width:44,height:44,borderRadius:12,flexShrink:0,background:`${catColors[a.category]||C.indigo}15`,display:"flex",alignItems:"center",justifyContent:"center",color:catColors[a.category]||C.indigo}}>
                    {a.priority==="high"?<AlertTriangle size={17}/>:a.category==="event"?<Star size={17}/>:a.category==="exam"?<BookMarked size={17}/>:a.category==="fee"?<CreditCard size={17}/>:<Bell size={17}/>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div style={{fontSize:15,fontWeight:700,color:C.txt}}>{a.title}</div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0,marginLeft:12}}>
                        {a.emailStatus&&<EmailStatusBadge status={a.emailStatus} count={a.emailCount}/>}
                        {a.priority==="high"&&<Pill label="Urgent" color={C.rose} bg="rgba(244,63,94,0.1)" size="xs"/>}
                        <Pill label={(a.category||"general").charAt(0).toUpperCase()+(a.category||"general").slice(1)} color={catColors[a.category]||C.indigo} bg={`${catColors[a.category]||C.indigo}12`} size="xs"/>
                      </div>
                    </div>
                    <div style={{fontSize:13,color:C.txt2,lineHeight:1.6,marginBottom:8}}>{a.body}</div>
                    <div style={{fontSize:11,color:C.dim,display:"flex",gap:10}}><span>{fmt(a.date||a.createdAt)}</span><span>·</span><span>{a.author}</span></div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  LEAVE PANEL PAGE
// ══════════════════════════════════════════════════════
const LeavePanelPage = ({leaves,setLeaves,api,toast}) => {
  const [tab,setTab]=useState("pending");
  const [loading,setLoad]=useState(null);
  const review=async(id,status)=>{
    setLoad(id+status);
    try{const updated=await api.reviewLeave(id,status);setLeaves(prev=>prev.map(l=>l._id===id?updated:l));toast(`Leave ${status}`,"success");}
    catch(e){toast(e.message);}
    finally{setLoad(null);}
  };
  const filtered=leaves.filter(l=>l.status===tab);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {[["pending",C.amber],["approved",C.emerald],["rejected",C.rose]].map(([s,c])=>(
          <StatCard key={s} label={s.charAt(0).toUpperCase()+s.slice(1)} value={leaves.filter(l=>l.status===s).length} color={c} icon={<FileText size={15}/>}/>
        ))}
      </div>
      <div style={{display:"flex",gap:4,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:12,padding:4,width:"fit-content"}}>
        {["pending","approved","rejected"].map(t=>{
          const count=leaves.filter(l=>l.status===t).length;
          const {color}=statusMeta(t);
          return (
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:"8px 18px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.15s",border:"none",fontFamily:F,background:tab===t?`${color}18`:"transparent",color:tab===t?color:C.txt2}}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
              {count>0&&<span style={{marginLeft:5,background:`${color}22`,borderRadius:8,padding:"1px 7px",fontSize:10}}>{count}</span>}
            </button>
          );
        })}
      </div>
      {filtered.length===0&&<Card style={{padding:56,textAlign:"center"}}><Inbox size={36} style={{color:C.txt2,opacity:0.2,display:"block",margin:"0 auto 12px"}}/><div style={{color:C.txt2,fontSize:14}}>No {tab} requests</div></Card>}
      <AnimatePresence>
        {filtered.map((l,i)=>{
          const st=l.studentId;const days=dateRange(l.from,l.to).length;
          return (
            <motion.div key={l._id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:i*0.05}}>
              <Card style={{padding:22}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <Avatar name={st?.name||"?"} size={42} color={C.violet}/>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:C.txt}}>{st?.name}</div>
                      <div style={{fontSize:12,color:C.txt2}}>Roll #{st?.rollNo}</div>
                    </div>
                  </div>
                  <StatusPill status={l.status}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:14}}>
                  {[{label:"Type",value:l.type},{label:"From",value:fmt(l.from)},{label:"To",value:fmt(l.to)},{label:"Days",value:`${days}d`},{label:"Applied",value:fmt(l.appliedAt)}].map(x=>(
                    <div key={x.label} style={{background:"rgba(255,255,255,0.03)",borderRadius:9,padding:"9px 12px",border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:9,color:C.txt2,letterSpacing:0.8,marginBottom:3,fontWeight:700}}>{x.label.toUpperCase()}</div>
                      <div style={{fontSize:13,color:C.txt,fontWeight:600}}>{x.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:"rgba(255,255,255,0.02)",borderRadius:9,padding:"11px 13px",border:`1px solid ${C.border}`,marginBottom:l.status==="pending"?14:0}}>
                  <div style={{fontSize:9,color:C.txt2,letterSpacing:0.8,marginBottom:4,fontWeight:700}}>REASON</div>
                  <div style={{fontSize:13,color:C.txt,lineHeight:1.55}}>{l.reason}</div>
                </div>
                {l.status==="pending"&&(
                  <div style={{display:"flex",gap:10}}>
                    <Btn variant="success" size="sm" disabled={!!loading} onClick={()=>review(l._id,"approved")} style={{flex:1,justifyContent:"center"}}>
                      {loading===l._id+"approved"?<Loader size={12} style={{animation:"spin 1s linear infinite"}}/>:<ThumbsUp size={13}/>}Approve
                    </Btn>
                    <Btn variant="danger" size="sm" disabled={!!loading} onClick={()=>review(l._id,"rejected")} style={{flex:1,justifyContent:"center"}}>
                      {loading===l._id+"rejected"?<Loader size={12} style={{animation:"spin 1s linear infinite"}}/>:<ThumbsDown size={13}/>}Reject
                    </Btn>
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
//  ANALYTICS PAGE
// ══════════════════════════════════════════════════════
const AnalyticsPage = ({students,api}) => {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [lastUpdate,setLastUpdate]=useState(new Date());

  useEffect(()=>{
    api.getAnalytics().then(d=>{setData(d);setLastUpdate(new Date());}).catch(()=>setData(null)).finally(()=>setLoading(false));
  },[]);

  const weeklyAtt=data?.weeklyAttendance||[65,72,68,80,74,76,82];
  const gradeDist=data?.gradeDistribution||[{label:"F",count:8},{label:"D",count:12},{label:"C",count:18},{label:"C+",count:22},{label:"B",count:15},{label:"B+",count:7},{label:"A",count:3}];
  const subjPerf=data?.subjectPerformance||[];
  const atRisk=data?.atRiskStudents||[];
  const updateTime=lastUpdate.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
        style={{background:`linear-gradient(135deg,${C.cyan}18,${C.surface} 60%)`,border:`1px solid ${C.cyan}30`,borderRadius:16,padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,color:C.cyan,fontWeight:700,letterSpacing:1,marginBottom:2}}>📊 SYSTEM ANALYTICS</div>
          <div style={{fontSize:13,color:C.txt2}}>Generated {lastUpdate.toLocaleDateString("en-US",{month:"short",day:"2-digit"})} at {updateTime}</div>
        </div>
        <div style={{textAlign:"right",fontSize:12,color:C.cyan,fontWeight:700}}>
          <div>Last 7 days</div>
          <div style={{fontSize:10,color:C.txt2,fontWeight:500,marginTop:2}}>Real-time data</div>
        </div>
      </motion.div>
      
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        <StatCard label="Avg Attendance" value={`${data?.avgAttendance??76}%`} color={C.indigo} icon={<Activity size={15}/>} trend={data?.attendanceTrend??4} delay={0}/>
        <StatCard label="Class Avg Grade" value={data?.avgGrade??"B"} color={C.emerald} icon={<GraduationCap size={15}/>} delay={0.05}/>
        <StatCard label="Passing Rate" value={`${data?.passingRate??94}%`} color={C.cyan} icon={<TrendingUp size={15}/>} delay={0.1}/>
        <StatCard label="At-Risk Students" value={data?.atRiskCount??atRisk.length} color={C.rose} icon={<AlertTriangle size={15}/>} delay={0.15}/>
      </div>
      {loading&&<Card style={{padding:48,textAlign:"center"}}><Loader size={20} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 10px"}}/></Card>}
      {!loading&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card style={{padding:22}}>
              <div style={{fontSize:11,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:4}}>ATTENDANCE TREND (7 WEEKS)</div>
              <div style={{fontSize:28,fontWeight:900,color:C.txt,marginBottom:2}}>{weeklyAtt[weeklyAtt.length-1]}%</div>
              <MiniLineChart data={weeklyAtt} color={C.indigo} height={70}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:9,color:C.dim}}>
                {["W1","W2","W3","W4","W5","W6","W7"].map(w=><span key={w}>{w}</span>)}
              </div>
              <div style={{fontSize:9,color:C.txt2,marginTop:8,fontStyle:"italic"}}>Updated: {updateTime}</div>
            </Card>
            <Card style={{padding:22}}>
              <div style={{fontSize:11,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:14}}>GRADE DISTRIBUTION</div>
              <BarGroup data={gradeDist.map(g=>g.count)} maxVal={Math.max(...gradeDist.map(g=>g.count),1)} colors={[C.rose,C.rose,C.amber,C.amber,C.emerald,C.cyan,C.indigo]}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                {gradeDist.map((g,i)=>(
                  <div key={i} style={{textAlign:"center",flex:1}}>
                    <div style={{fontSize:9,color:C.txt2,fontWeight:700}}>{g.label}</div>
                    <div style={{fontSize:10,color:C.dim}}>{g.count}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {subjPerf.length>0&&(
            <Card style={{padding:22}}>
              <SectionHeader title="Subject Performance" icon={<BarChart2 size={15}/>} subtitle="Average scores across subjects"/>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {subjPerf.map((s,i)=>(
                  <div key={i}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                      <span style={{fontSize:13,color:C.txt,fontWeight:500}}>{s.subject}</span>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontSize:12,color:C.txt2}}>{s.avg}%</span>
                        <span style={{fontSize:12,fontWeight:800,color:gradeColor(s.avg)}}>{gradeLabel(s.avg)}</span>
                      </div>
                    </div>
                    <div style={{height:7,background:"rgba(255,255,255,0.05)",borderRadius:6,overflow:"hidden"}}>
                      <motion.div initial={{width:0}} animate={{width:`${s.avg}%`}} transition={{delay:i*0.1+0.3,duration:0.8,ease:"easeOut"}}
                        style={{height:"100%",borderRadius:6,background:`linear-gradient(90deg,${subjectColors[s.subject]||C.indigo},${subjectColors[s.subject]||C.indigo}88)`}}/>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {atRisk.length>0&&(
            <Card style={{padding:22}}>
              <SectionHeader title="At-Risk Students" icon={<AlertTriangle size={15}/>} subtitle="Students needing attention"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
                {atRisk.map((s,i)=>(
                  <div key={i} style={{padding:"14px 16px",background:`${C.rose}08`,borderRadius:12,border:`1px solid ${C.rose}22`}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
                      <Avatar name={s.name} size={36} color={C.rose}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{s.name}</div>
                        <div style={{fontSize:11,color:C.txt2}}>#{s.rollNo}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <Pill label={`Att: ${s.attendance}%`} color={C.orange} bg="rgba(249,115,22,0.1)" size="xs"/>
                      <Pill label={`Grade: ${s.grade}`} color={C.rose} bg="rgba(244,63,94,0.1)" size="xs"/>
                    </div>
                    <div style={{fontSize:11,color:C.rose,marginTop:8,fontWeight:600}}>⚠ {s.issue}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  PARENTS PAGE
// ══════════════════════════════════════════════════════
const ParentsPage = ({students,api,toast}) => {
  const [messages,setMessages]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [retrying,setRetrying]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [expandedId,setExpandedId]=useState(null);
  const [filterType,setFilterType]=useState("all");
  const [form,setForm]=useState({studentId:"",parentName:"",parentEmail:"",title:"",message:"",type:"announcement"});

  const selectedStudent=students.find(s=>s._id===form.studentId);
  useEffect(()=>{if(selectedStudent)setForm(p=>({...p,parentName:selectedStudent.parentName||"",parentEmail:selectedStudent.parentEmail||""}));},[form.studentId]);

  useEffect(()=>{
    api.getParentMessages().then(msgs=>setMessages(Array.isArray(msgs)?msgs:[])).catch(()=>setMessages([])).finally(()=>setLoading(false));
  },[]);

  const sendMessage=async()=>{
    if(!form.studentId||!form.parentEmail||!form.title||!form.message) return toast("Fill all required fields");
    setSending(true);
    const optimistic={_id:"tmp_"+Date.now(),...form,studentName:selectedStudent?.name||"",rollNo:selectedStudent?.rollNo||"",date:today(),author:"Admin",emailStatus:"sending",createdAt:new Date().toISOString()};
    setMessages(p=>[optimistic,...p]);setShowForm(false);setForm({studentId:"",parentName:"",parentEmail:"",title:"",message:"",type:"announcement"});
    try{
      const result=await api.sendParentMessage({...form,studentName:selectedStudent?.name||"",rollNo:selectedStudent?.rollNo||"",author:"Admin",date:today()});
      setMessages(p=>p.map(m=>m._id===optimistic._id?{...(result.message||result),emailStatus:result.emailStatus||"sent"}:m));
      toast("Message sent to parent!","success");
    }catch(e){
      setMessages(p=>p.map(m=>m._id===optimistic._id?{...m,emailStatus:"failed"}:m));
      toast(e.message);
    }finally{setSending(false);}
  };

  const retryEmail=async(msg)=>{
    setRetrying(msg._id);
    try{await api.resendParentMsg(msg._id);setMessages(p=>p.map(m=>m._id===msg._id?{...m,emailStatus:"sent"}:m));toast("Email re-sent!","success");}
    catch(e){toast(e.message);}
    finally{setRetrying(null);}
  };

  const deleteMessage=async(id)=>{
    if(!confirm("Delete this message?")) return;
    try{await api.deleteParentMsg(id);setMessages(p=>p.filter(m=>m._id!==id));toast("Deleted","success");}
    catch(e){toast(e.message);}
  };

  const typeConfig={
    announcement:{color:C.indigo,bg:"rgba(108,99,255,0.1)",icon:"📢",label:"Announcement"},
    complaint:   {color:C.orange,bg:"rgba(249,115,22,0.1)", icon:"⚠️",label:"Complaint"},
    achievement: {color:C.emerald,bg:"rgba(16,185,129,0.1)",icon:"🏆",label:"Achievement"},
    warning:     {color:C.rose,  bg:"rgba(244,63,94,0.1)",  icon:"🚨",label:"Warning"},
  };
  const filtered=messages.filter(m=>filterType==="all"||m.type===filterType);
  const counts={total:messages.length,sent:messages.filter(m=>m.emailStatus==="sent").length,failed:messages.filter(m=>m.emailStatus==="failed").length};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        <StatCard label="Total Messages" value={counts.total} color={C.indigo} icon={<MessageSquare size={15}/>} delay={0}/>
        <StatCard label="Emails Sent" value={counts.sent} color={C.emerald} icon={<CheckCircle size={15}/>} delay={0.05}/>
        <StatCard label="Failed" value={counts.failed} color={C.rose} icon={<XCircle size={15}/>} delay={0.1}/>
        <StatCard label="Parents Contacted" value={new Set(messages.map(m=>m.parentEmail)).size} color={C.cyan} icon={<Users size={15}/>} delay={0.15}/>
      </div>
      <Card style={{padding:"14px 18px"}}>
        <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:3,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:3}}>
            {["all","announcement","complaint","achievement","warning"].map(t=>(
              <button key={t} onClick={()=>setFilterType(t)}
                style={{padding:"5px 11px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",fontFamily:F,transition:"all 0.14s",background:filterType===t?(typeConfig[t]||{color:C.indigo}).color||C.indigo:"transparent",color:filterType===t?"#fff":C.txt2}}>
                {t==="all"?"All":typeConfig[t]?.label}
              </button>
            ))}
          </div>
          <Btn size="sm" onClick={()=>setShowForm(p=>!p)}><MessageSquare size={13}/>{showForm?"Cancel":"New Message"}</Btn>
        </div>
        <AnimatePresence>
          {showForm&&(
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden"}}>
              <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:14,padding:"18px",background:"rgba(255,255,255,0.02)",borderRadius:14,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:11,fontWeight:700,color:C.indigo,letterSpacing:1}}>COMPOSE PARENT MESSAGE</div>
                <Select label="Select Student" value={form.studentId} onChange={e=>setForm(p=>({...p,studentId:e.target.value}))}>
                  <option value="" style={{background:C.surface2}}>— Select student —</option>
                  {students.map(s=><option key={s._id} value={s._id} style={{background:C.surface2}}>{s.name} (#{s.rollNo})</option>)}
                </Select>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <Input label="Parent Name" placeholder="Auto-filled or type manually" value={form.parentName} onChange={e=>setForm(p=>({...p,parentName:e.target.value}))}/>
                  <Input label="Parent Email *" type="email" placeholder="parent@example.com" value={form.parentEmail} onChange={e=>setForm(p=>({...p,parentEmail:e.target.value}))}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:8}}>MESSAGE TYPE</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {Object.entries(typeConfig).map(([k,v])=>(
                      <motion.button key={k} whileTap={{scale:0.96}} onClick={()=>setForm(p=>({...p,type:k}))}
                        style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F,transition:"all 0.15s",border:"none",background:form.type===k?v.bg:"rgba(255,255,255,0.03)",color:form.type===k?v.color:C.txt2,boxShadow:form.type===k?`0 0 0 1.5px ${v.color}40`:"none"}}>
                        <span>{v.icon}</span>{v.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <Input label="Subject / Title *" placeholder="e.g. Attendance Warning for March" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:6}}>MESSAGE BODY *</div>
                  <textarea value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} placeholder="Write your message to the parent here…" rows={4}
                    style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.txt,fontFamily:F,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",resize:"vertical",lineHeight:1.6,transition:"border-color 0.2s"}}
                    onFocus={e=>e.target.style.borderColor=C.indigo}
                    onBlur={e=>e.target.style.borderColor=C.border}/>
                </div>
                {form.title&&(
                  <motion.div initial={{opacity:0}} animate={{opacity:1}}
                    style={{background:"rgba(34,211,238,0.06)",border:"1px solid rgba(34,211,238,0.2)",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}>
                    <Globe size={12} color={C.cyan}/>
                    <div>
                      <div style={{fontSize:9,color:C.cyan,fontWeight:700,letterSpacing:0.8,marginBottom:2}}>EMAIL SUBJECT PREVIEW</div>
                      <div style={{fontSize:12,color:C.txt}}>{form.type==="complaint"||form.type==="warning"?"⚠️ Important: ":form.type==="achievement"?"🏆 ":"📢 "}{form.title}</div>
                    </div>
                  </motion.div>
                )}
                <Btn full onClick={sendMessage} disabled={sending||!form.parentEmail||!form.title||!form.message}>
                  {sending?<><Loader size={13} style={{animation:"spin 1s linear infinite"}}/>Sending…</>:<><Send size={13}/>Send to Parent</>}
                </Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
      {loading?<Card style={{padding:48,textAlign:"center"}}><Loader size={20} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 10px"}}/></Card>
      :filtered.length===0?<Card style={{padding:60,textAlign:"center"}}><MessageSquare size={40} style={{color:C.txt2,opacity:0.15,display:"block",margin:"0 auto 14px"}}/><div style={{fontSize:14,color:C.txt2}}>No messages yet</div></Card>
      :(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <AnimatePresence>
            {filtered.map((msg,i)=>{
              const tc=typeConfig[msg.type]||typeConfig.announcement;
              const isExpanded=expandedId===msg._id;
              return (
                <motion.div key={msg._id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.98}} transition={{delay:i*0.04}}>
                  <Card hover style={{padding:0,overflow:"hidden"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",cursor:"pointer"}}
                      onClick={()=>setExpandedId(isExpanded?null:msg._id)}>
                      <div style={{display:"flex",gap:14,alignItems:"center",flex:1,minWidth:0}}>
                        <div style={{width:42,height:42,borderRadius:12,flexShrink:0,background:tc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{tc.icon}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:C.txt,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{msg.title}</div>
                          <div style={{fontSize:11,color:C.txt2,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            <span style={{display:"flex",alignItems:"center",gap:3}}><Users size={9}/>{msg.studentName||"Student"} (#{msg.rollNo})</span>
                            <span>→</span><span>{msg.parentName||msg.parentEmail}</span>
                            <span>·</span><span>{fmt(msg.date||msg.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:12}}>
                        <EmailStatusBadge status={msg.emailStatus}/>
                        <Pill label={tc.label} color={tc.color} bg={tc.bg} size="xs"/>
                        {isExpanded?<ChevronUp size={13} color={C.txt2}/>:<ChevronDown size={13} color={C.txt2}/>}
                      </div>
                    </div>
                    <AnimatePresence>
                      {isExpanded&&(
                        <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
                          <div style={{padding:"0 20px 18px",borderTop:`1px solid ${C.border}`}}>
                            <div style={{paddingTop:16,display:"flex",flexDirection:"column",gap:12}}>
                              <div style={{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"14px 16px",border:`1px solid ${tc.color}22`,borderLeft:`3px solid ${tc.color}`}}>
                                <div style={{fontSize:12,color:C.txt,lineHeight:1.7}}>{msg.message}</div>
                              </div>
                              <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
                                <div style={{fontSize:11,color:C.txt2,display:"flex",gap:12}}>
                                  <span>Sent by <strong style={{color:C.txt}}>{msg.author||"Admin"}</strong></span>
                                  <span>·</span><span>{fmt(msg.date||msg.createdAt)}</span>
                                  <span>·</span><span style={{fontFamily:"monospace",color:C.dim}}>{msg.parentEmail}</span>
                                </div>
                                <div style={{display:"flex",gap:8}}>
                                  {msg.emailStatus==="failed"&&(
                                    <Btn variant="amber" size="xs" disabled={retrying===msg._id} onClick={()=>retryEmail(msg)}>
                                      {retrying===msg._id?<Loader size={10} style={{animation:"spin 1s linear infinite"}}/>:<RefreshCw size={10}/>}Retry
                                    </Btn>
                                  )}
                                  <Btn variant="danger" size="xs" onClick={()=>deleteMessage(msg._id)}><Trash2 size={10}/>Delete</Btn>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  ADMIN DASHBOARD CONTAINER
// ══════════════════════════════════════════════════════
const AdminDashboard = ({token,onLogout,theme,setTheme}) => {
  const api = useMemo(()=>makeApi(token),[token]);
  const [students,  setStudents]  = useState([]);
  const [attendance,setAttendance]= useState({});
  const [leaves,    setLeaves]    = useState([]);
  const [view,      setView]      = useState("dashboard");
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(()=> typeof window !== "undefined" && window.innerWidth < 900);
  const [toastEl,   toast]        = useToast();

  useEffect(()=>{
    Promise.all([api.getStudents(),api.getLeaves(),api.getAttendance(today())])
      .then(([s,l,a])=>{setStudents(s);setLeaves(l);setAttendance(a);})
      .catch(e=>toast(e.message))
      .finally(()=>setLoading(false));
  },[]);

  const pageTitles={dashboard:"Overview",attendance:"Attendance",students:"Students",classes:"Classes",exams:"Exams",grades:"Grades",leaves:"Leave Requests",fees:"Fee Management",timetable:"Timetable",announcements:"Announcements",parents:"Parent Communication",notifications:"Notifications",analytics:"Analytics"};

  const renderPage=()=>{
    if(loading) return <div style={{padding:60,textAlign:"center",color:C.txt2}}><Loader size={28} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 14px"}}/>Loading system data…</div>;
    switch(view){
      case "dashboard":    return <AdminOverview students={students} attendance={attendance} leaves={leaves} api={api} toast={toast}/>;
      case "attendance":   return <AttendancePage students={students} attendance={attendance} setAttendance={setAttendance} api={api} toast={toast}/>;
      case "students":     return <StudentsPage students={students} setStudents={setStudents} api={api} toast={toast}/>;
      case "classes":      return <ClassesPage api={api} toast={toast}/>;
      case "exams":        return <ExamsPage students={students} api={api} toast={toast}/>;
      case "grades":       return <GradesPage students={students} api={api} toast={toast} isAdmin={true}/>;
      case "leaves":       return <LeavePanelPage leaves={leaves} setLeaves={setLeaves} api={api} toast={toast}/>;
      case "fees":         return <FeesPage students={students} api={api} toast={toast} isAdmin={true}/>;
      case "timetable":    return <TimetablePage api={api} toast={toast} isAdmin={true}/>;
      case "announcements":return <AnnouncementsPage isAdmin api={api} toast={toast}/>;
      case "parents":      return <ParentsPage students={students} api={api} toast={toast}/>;
      case "notifications":return <NotificationsPage api={api} toast={toast}/>;
      case "analytics":    return <AnalyticsPage students={students} api={api}/>;
      default: return null;
    }
  };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:F,color:C.txt,position:"relative"}}>
      <Sidebar nav={adminNav} active={view} setActive={setView} user={{name:"Admin",role:"Administrator"}} onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,position:"relative"}}>
        <TopBar title={pageTitles[view]||"ACADEXA by ASAD"} subtitle={`${students.length} students enrolled`}
          theme={theme}
          onToggleSidebar={()=>setCollapsed(p=>!p)}
          actions={
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <ThemeSwitcher theme={theme} setTheme={setTheme}/>
              <motion.button
                whileHover={{scale:1.08}} whileTap={{scale:0.95}}
                onClick={()=>setView("notifications")}
                title="Notifications"
                style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:9,padding:8,cursor:"pointer",color:C.txt2,display:"flex",position:"relative",zIndex:10}}>
                <Bell size={15}/>
                {(leaves.filter(l=>l.status==="pending").length>0)&&(
                  <div style={{position:"absolute",top:-2,right:-2,width:14,height:14,borderRadius:"50%",background:C.rose,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#fff"}}>
                    {leaves.filter(l=>l.status==="pending").length}
                  </div>
                )}
              </motion.button>
            </div>
          }/>
        <div style={{flex:1,padding:"24px 28px",overflowY:"auto",position:"relative",zIndex:1,pointerEvents:loading?"none":"auto"}}>
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.2}}>
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {toastEl}
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  STUDENT PORTAL CONTAINER
// ══════════════════════════════════════════════════════
const StudentPortal = ({student,token,onLogout,theme,setTheme}) => {
  const api = useMemo(()=>makeApi(token),[token]);
  const [leaves,  setLeaves]   = useState([]);
  const [view,    setView]     = useState("dashboard");
  const [loading, setLoading]  = useState(true);
  const [collapsed,setCollapsed]=useState(()=> typeof window !== "undefined" && window.innerWidth < 900);
  const [toastEl, toast]       = useToast();
  const sid=student._id||student.id||"";

  useEffect(()=>{
    api.getLeaves().then(setLeaves).catch(e=>toast(e.message)).finally(()=>setLoading(false));
  },[]);

  // Student attendance page
  const StudentAttendancePage = () => {
    const [history,setHistory]=useState([]);
    const [loadHist,setLoadHist]=useState(true);
    const [currentDate,setCurrentDate]=useState(new Date().toISOString().split("T")[0]);
    
    useEffect(()=>{
      api.getHistory(sid,30).then(d=>setHistory(Array.isArray(d)?d:[])).catch(()=>setHistory([])).finally(()=>setLoadHist(false));
    },[]);
    
    const present=history.filter(d=>d.status==="present").length;
    const leave=history.filter(d=>d.status==="leave").length;
    const absent=history.filter(d=>d.status==="absent").length;
    const attRate=Math.round(present/Math.max(history.length,1)*100);
    const lastMarked=history[0]?new Date(history[0].date).toLocaleDateString("en-US",{month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"N/A";
    
    return (
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
          <StatCard label="Attendance Rate" value={`${attRate}%`} color={attRate>=75?C.emerald:C.rose} icon={<Activity size={15}/>} delay={0}/>
          <StatCard label="Days Present" value={present} color={C.emerald} icon={<CheckCircle size={15}/>} delay={0.05}/>
          <StatCard label="On Leave" value={leave} color={C.violet} icon={<CalendarDays size={15}/>} delay={0.1}/>
          <StatCard label="Absent" value={absent} color={C.rose} icon={<XCircle size={15}/>} delay={0.15}/>
        </div>
        {loadHist?<Card style={{padding:48,textAlign:"center"}}><Loader size={20} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto"}}/></Card>:(
          <Card style={{padding:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <SectionHeader title="30-Day Attendance" icon={<Activity size={15}/>} subtitle={`Last marked: ${lastMarked}`}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:24,marginBottom:20}}>
              <div style={{position:"relative",flexShrink:0}}>
                <RingChart size={100} stroke={11} segments={[{color:C.emerald,pct:present/Math.max(history.length,1)},{color:C.violet,pct:leave/Math.max(history.length,1)},{color:C.rose,pct:absent/Math.max(history.length,1)}]}/>
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:C.txt}}>{attRate}%</div>
                </div>
              </div>
              <div style={{flex:1}}>
                {[{col:C.emerald,l:"Present",v:present},{col:C.violet,l:"Leave",v:leave},{col:C.rose,l:"Absent",v:absent}].map(x=>(
                  <div key={x.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.txt2}}><div style={{width:9,height:9,borderRadius:2,background:x.col}}/>{x.l}</div>
                    <div style={{fontSize:15,fontWeight:700,color:C.txt}}>{x.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:2,alignItems:"flex-end",height:50}}>
              {history.map((d,i)=>{
                const col=d.status==="present"?C.emerald:d.status==="leave"?C.violet:d.status==="absent"?C.rose:"rgba(255,255,255,0.06)";
                const h=d.status==="present"?"100%":d.status==="leave"?"60%":d.status==="absent"?"25%":"8%";
                return <div key={i} title={`${d.date}: ${d.status}`} style={{flex:1,minWidth:2,borderRadius:2,height:h,background:col,transition:"height 0.5s ease",transitionDelay:`${i*0.01}s`}}/>;
              })}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:9,color:C.dim}}><span>30d ago</span><span>Today ({currentDate})</span></div>
          </Card>
        )}
      </div>
    );
  };

  // Student overview dashboard
  const StudentOverview = () => {
    const [dashGrades,setDashGrades]=useState([]);
    const [dashTimetable,setDashTimetable]=useState({});
    const [upcomingExams,setUpcomingExams]=useState([]);
    const [timeData,setTimeData]=useState(new Date());
    const [fees,setFees]=useState([]);
    
    useEffect(()=>{
      const timer=setInterval(()=>setTimeData(new Date()),1000);
      api.getGrades(sid).then(d=>setDashGrades(Array.isArray(d)?d:[])).catch(()=>{});
      api.getTimetable().then(d=>{ if(Array.isArray(d)){const obj={};d.forEach(c=>{if(!obj[c.day])obj[c.day]=[];obj[c.day].push(c);});setDashTimetable(obj);}else setDashTimetable(d||{});}).catch(()=>{});
      api.getExams().then(d=>setUpcomingExams(Array.isArray(d)?d.filter(e=>e.status==="upcoming").slice(0,3):[])).catch(()=>{});
      api.getFees(sid).then(d=>setFees(Array.isArray(d)?d:[])).catch(()=>{});
      return()=>clearInterval(timer);
    },[]);
    
    const avgPct=dashGrades.length?Math.round(dashGrades.reduce((s,g)=>s+(g.marks/g.maxMarks*100),0)/dashGrades.length):0;
    const todayName=new Date().toLocaleDateString("en-US",{weekday:"long"});
    const todayClasses=dashTimetable[todayName]||[];
    const unpaidFees=fees.filter(f=>f.status!=="paid").reduce((s,f)=>s+(Number(f.amount)||0),0);
    const currentTime=timeData.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
    const currentDate=timeData.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"2-digit"});
    
    return (
      <div style={{display:"flex",flexDirection:"column",gap:20}}>
        <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
          style={{background:`linear-gradient(135deg,${C.violet}18,${C.surface} 60%)`,border:`1px solid ${C.violet}30`,borderRadius:20,padding:"24px 28px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <Avatar name={student.name} size={56} color={C.violet} img={student.photo||undefined}/>
            <div>
              <div style={{fontSize:12,color:C.violet,fontWeight:700,letterSpacing:1,marginBottom:3}}>STUDENT PORTAL</div>
              <div style={{fontSize:20,fontWeight:900,color:C.txt}}>{student.name}</div>
              <div style={{fontSize:12,color:C.txt2}}>Roll #{student.rollNo} · {currentDate} at {currentTime}</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:44,fontWeight:900,color:gradeColor(avgPct),letterSpacing:-2,fontFamily:FD}}>{gradeLabel(avgPct)}</div>
            <div style={{fontSize:11,color:C.txt2,fontWeight:700,letterSpacing:0.5}}>CURRENT GRADE</div>
          </div>
        </motion.div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
          <StatCard label="Avg Score" value={`${avgPct}%`} color={gradeColor(avgPct)} icon={<GraduationCap size={15}/>} delay={0}/>
          <StatCard label="Pending Leaves" value={leaves.filter(l=>l.status==="pending").length} color={C.amber} icon={<Clock size={15}/>} delay={0.05}/>
          <StatCard label="Approved Leaves" value={leaves.filter(l=>l.status==="approved").length} color={C.emerald} icon={<CheckCircle size={15}/>} delay={0.1}/>
          <StatCard label="Fees Due" value={unpaidFees>0?`₨${(unpaidFees/1000).toFixed(0)}K`:"Paid"} color={unpaidFees>0?C.rose:C.emerald} icon={<CreditCard size={15}/>} delay={0.15}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card style={{padding:22}}>
            <SectionHeader title="My Grades" icon={<GraduationCap size={14}/>} subtitle="Current semester"/>
            {dashGrades.length===0?<div style={{textAlign:"center",color:C.txt2,fontSize:13,padding:20}}>No grades recorded yet.</div>:
            dashGrades.slice(0,4).map((g,i)=>{const pct=Math.round(g.marks/g.maxMarks*100);return(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:12,color:C.txt}}>{g.subject}</span>
                  <span style={{fontSize:12,fontWeight:800,color:gradeColor(pct)}}>{gradeLabel(pct)} ({pct}%)</span>
                </div>
                <div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden"}}>
                  <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:i*0.1,duration:0.6}} style={{height:"100%",borderRadius:4,background:gradeColor(pct)}}/>
                </div>
              </div>
            );})}
          </Card>
          <Card style={{padding:22}} glow>
            <SectionHeader title="Today's Schedule" icon={<Grid size={14}/>} subtitle={todayName}/>
            {todayClasses.length===0?<div style={{textAlign:"center",color:C.txt2,padding:24,fontSize:13}}>No classes today 🎉</div>:
            todayClasses.map((cls,i)=>(
              <div key={i} style={{display:"flex",gap:14,alignItems:"center",padding:"10px 14px",background:"rgba(255,255,255,0.02)",borderRadius:10,border:`1px solid ${C.border}`,borderLeft:`3px solid ${subjectColors[cls.subject]||C.indigo}`,marginBottom:8}}>
                <div style={{width:60,fontSize:11,fontWeight:700,color:C.txt2}}>{(cls.time||"").split("-")[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:subjectColors[cls.subject]||C.indigo}}>{cls.subject}</div>
                  <div style={{fontSize:11,color:C.txt2}}>{cls.teacher} · {cls.room}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
        {upcomingExams.length>0 && (
          <Card style={{padding:22}}>
            <SectionHeader title="Upcoming Exams" icon={<BookMarked size={14}/>} subtitle="Next scheduled exams"/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
              {upcomingExams.map((exam,i)=>(
                <div key={i} style={{padding:14,background:`linear-gradient(135deg,${C.cyan}12,${C.surface})`,border:`1px solid ${C.border}`,borderRadius:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.cyan,marginBottom:4}}>{exam.subject}</div>
                  <div style={{fontSize:14,fontWeight:700,color:C.txt}}>{exam.name}</div>
                  <div style={{fontSize:11,color:C.txt2,marginTop:6}}>📅 {fmt(exam.date)}</div>
                  {exam.venue && <div style={{fontSize:11,color:C.txt2}}>📍 {exam.venue}</div>}
                  <div style={{fontSize:11,color:C.txt2,marginTop:4}}>Max marks: {exam.maxMarks}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  // Student classes view
  const StudentClasses = () => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState(null);
    
    useEffect(() => {
      api.getClasses()
        .then(c => setClasses(Array.isArray(c) ? c : []))
        .catch(() => setClasses([]))
        .finally(() => setLoading(false));
    }, []);
    
    const classesByDay = {};
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    days.forEach(d => classesByDay[d] = []);
    classes.forEach(c => {
      if (classesByDay[c.scheduleDay]) classesByDay[c.scheduleDay].push(c);
    });
    
    return (
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <StatCard label="Total Classes" value={classes.length} color={C.indigo} icon={<BookOpen size={15}/>} delay={0}/>
        
        {loading ? (
          <div style={{padding:40,textAlign:"center"}}><Loader size={18} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto"}}/></div>
        ) : (
          <Card style={{padding:22}}>
            <SectionHeader title="Class Schedule" icon={<BookOpen size={15}/>} subtitle="Weekly schedule"/>
            {classes.length === 0 ? (
              <div style={{padding:32,textAlign:"center",color:C.txt2}}>No classes assigned yet</div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                {days.map(day => classesByDay[day].length > 0 && (
                  <div key={day}>
                    <div style={{fontSize:12,fontWeight:700,color:C.indigo,letterSpacing:1,marginBottom:8}}>{day.toUpperCase()}</div>
                    {classesByDay[day].map(cls => (
                      <motion.div key={cls._id} whileHover={{y:-2}} style={{marginBottom:8}}>
                        <Card style={{padding:14,cursor:"pointer",border:`1px solid ${C.border}`}} onClick={() => setSelectedClass(cls)}>
                          <div style={{fontSize:13,fontWeight:700,color:C.txt,marginBottom:2}}>{cls.className}</div>
                          <div style={{fontSize:11,color:C.txt2,marginBottom:6}}>
                            <div>📍 {cls.room}</div>
                            <div>🕐 {cls.scheduleTime}</div>
                            <div>👨‍🏫 {cls.teacher}</div>
                          </div>
                          {cls.tomorrowTopic && (
                            <div style={{background:`${C.cyan}15`,borderRadius:6,padding:8,fontSize:11,color:C.cyan,borderLeft:`2px solid ${C.cyan}`}}>
                              <strong>Next:</strong> {cls.tomorrowTopic}
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
        
        {selectedClass && (
          <Portal>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={() => setSelectedClass(null)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <motion.div initial={{scale:0.9}} animate={{scale:1}} exit={{scale:0.9}} onClick={e => e.stopPropagation()}
              style={{background:C.bg,borderRadius:16,padding:24,maxWidth:500,width:"100%",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:18,fontWeight:800,color:C.txt,marginBottom:16}}>{selectedClass.className}</div>
              <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16,fontSize:13,color:C.txt2}}>
                <div><strong>Room:</strong> {selectedClass.room}</div>
                <div><strong>Day:</strong> {selectedClass.scheduleDay}</div>
                <div><strong>Time:</strong> {selectedClass.scheduleTime}</div>
                <div><strong>Teacher:</strong> {selectedClass.teacher}</div>
                <div><strong>Code:</strong> {selectedClass.classCode}</div>
                <div><strong>Semester:</strong> {selectedClass.semester}</div>
                {selectedClass.tomorrowTopic && (
                  <div style={{background:`${C.cyan}15`,borderRadius:8,padding:10,marginTop:8}}>
                    <strong style={{color:C.cyan}}>Next Class Topic:</strong>
                    <div style={{marginTop:6,color:C.txt}}>{selectedClass.tomorrowTopic}</div>
                  </div>
                )}
              </div>
              <Btn full onClick={() => setSelectedClass(null)} style={{marginTop:8}}>Close</Btn>
            </motion.div>
          </motion.div>
          </Portal>
        )}
      </div>
    );
  };

  // Student leave application
  const StudentLeaves = () => {
    const [lview,setLview]=useState("list");
    const [form,setForm]=useState({from:"",to:"",type:"Medical",reason:""});
    const [saving,setSaving]=useState(false);
    const [success,setSuccess]=useState(false);
    const myLeaves=[...leaves].sort((a,b)=>b.appliedAt?.localeCompare(a.appliedAt)||0);

    const submitLeave=async()=>{
      if(!form.from||!form.to||form.reason.trim().length<20) return toast("Fill all fields (reason min 20 chars)");
      if(form.to<form.from) return toast("End date must be after start date");
      setSaving(true);
      try{
        const newLeave=await api.applyLeave({...form,reason:form.reason.trim()});
        setLeaves(p=>[newLeave,...p]);
        setForm({from:"",to:"",type:"Medical",reason:""});
        setSuccess(true);
        setTimeout(()=>{setSuccess(false);setLview("list");},2200);
      }catch(e){toast(e.message);}
      finally{setSaving(false);}
    };

    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          <StatCard label="Total Applied" value={myLeaves.length} color={C.indigo} icon={<FileText size={15}/>}/>
          <StatCard label="Approved" value={myLeaves.filter(l=>l.status==="approved").length} color={C.emerald} icon={<CheckCircle size={15}/>}/>
          <StatCard label="Pending" value={myLeaves.filter(l=>l.status==="pending").length} color={C.amber} icon={<Clock size={15}/>}/>
        </div>
        <div style={{display:"flex",gap:4,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:12,padding:4,width:"fit-content"}}>
          {[{k:"list",label:"My Leaves"},{k:"apply",label:"Apply Leave"}].map(t=>(
            <button key={t.k} onClick={()=>{setLview(t.k);setSuccess(false);}}
              style={{padding:"7px 16px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",fontFamily:F,transition:"all 0.15s",background:lview===t.k?C.violet:"transparent",color:lview===t.k?"#fff":C.txt2}}>
              {t.label}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          {lview==="apply"?(
            <motion.div key="apply" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
              <Card style={{padding:28}}>
                <SectionHeader title="Leave Application" icon={<FileText size={15}/>} subtitle="Submit a leave request"/>
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    <Input label="From Date" type="date" value={form.from} min={today()} onChange={e=>setForm(p=>({...p,from:e.target.value}))}/>
                    <Input label="To Date" type="date" value={form.to} min={form.from||today()} onChange={e=>setForm(p=>({...p,to:e.target.value}))}/>
                  </div>
                  {form.from&&form.to&&form.to>=form.from&&(
                    <div style={{background:`${C.violet}10`,border:`1px solid ${C.violet}30`,borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:9}}>
                      <CalendarDays size={13} color={C.violet}/>
                      <span style={{fontSize:13,color:C.violet,fontWeight:600}}>{dateRange(form.from,form.to).length} day(s) · {fmt(form.from)}{form.from!==form.to?` → ${fmt(form.to)}`:""}</span>
                    </div>
                  )}
                  <Select label="Leave Type" value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                    {["Medical","Family Emergency","Casual","Personal","Academic","Travel","Other"].map(t=><option key={t} value={t} style={{background:C.surface2}}>{t}</option>)}
                  </Select>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.txt2,letterSpacing:1,marginBottom:6}}>REASON / DETAILS *</div>
                    <textarea value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} placeholder="Explain why you need this leave (minimum 20 characters)…" rows={5}
                      style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",color:C.txt,fontFamily:F,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",resize:"vertical",lineHeight:1.6,transition:"border-color 0.2s"}}
                      onFocus={e=>e.target.style.borderColor=C.violet}
                      onBlur={e=>e.target.style.borderColor=C.border}/>
                    <div style={{textAlign:"right",fontSize:10,color:form.reason.length<20?C.rose:C.emerald,marginTop:5,fontWeight:700}}>
                      {form.reason.length} chars {form.reason.length>=20?"✓":"— need "+(20-form.reason.length)+" more"}
                    </div>
                  </div>
                  <AnimatePresence mode="wait">
                    {success?(
                      <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
                        style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:12,padding:"15px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                        <CheckCircle size={18} color={C.emerald}/><span style={{fontSize:14,fontWeight:700,color:C.emerald}}>Submitted! Redirecting…</span>
                      </motion.div>
                    ):(
                      <Btn full size="lg" onClick={submitLeave} disabled={saving||form.reason.length<20}>
                        {saving?<><Loader size={14} style={{animation:"spin 1s linear infinite"}}/>Submitting…</>:<><Send size={14}/>Submit Application</>}
                      </Btn>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            </motion.div>
          ):(
            <motion.div key="list" initial={{opacity:0}} animate={{opacity:1}}>
              {myLeaves.length===0?<Card style={{padding:60,textAlign:"center"}}><BookOpen size={40} style={{color:C.txt2,opacity:0.18,display:"block",margin:"0 auto 14px"}}/><div style={{fontSize:14,color:C.txt2}}>No applications yet</div></Card>:(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {myLeaves.map((l,i)=>{
                    const days=dateRange(l.from,l.to).length;
                    return (
                      <motion.div key={l._id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:i*0.04}}>
                        <Card style={{padding:20}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                            <div>
                              <div style={{fontSize:15,fontWeight:700,color:C.txt}}>{l.type} Leave</div>
                              <div style={{fontSize:11,color:C.txt2}}>Applied {fmt(l.appliedAt)}</div>
                            </div>
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              <StatusPill status={l.status}/>
                              {l.status==="pending"&&(
                                <button onClick={async()=>{try{await api.deleteLeave(l._id);setLeaves(p=>p.filter(x=>x._id!==l._id));toast("Cancelled","success");}catch(e){toast(e.message);}}}
                                  style={{background:"rgba(244,63,94,0.08)",border:"none",borderRadius:7,padding:"5px 7px",cursor:"pointer",color:C.rose,display:"flex"}}>
                                  <Trash2 size={12}/>
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:12}}>
                            {[{label:"From",value:fmt(l.from)},{label:"To",value:fmt(l.to)},{label:"Days",value:`${days}d`}].map(x=>(
                              <div key={x.label} style={{background:"rgba(255,255,255,0.03)",borderRadius:9,padding:"9px 12px",border:`1px solid ${C.border}`}}>
                                <div style={{fontSize:9,color:C.txt2,letterSpacing:0.8,marginBottom:3,fontWeight:700}}>{x.label.toUpperCase()}</div>
                                <div style={{fontSize:13,color:C.txt,fontWeight:600}}>{x.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{background:"rgba(255,255,255,0.02)",borderRadius:9,padding:"10px 13px",border:`1px solid ${C.border}`}}>
                            <div style={{fontSize:9,color:C.txt2,letterSpacing:0.8,marginBottom:3,fontWeight:700}}>REASON</div>
                            <div style={{fontSize:13,color:C.txt,lineHeight:1.5}}>{l.reason}</div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Student notifications and announcements
  const StudentNotifications =() => {
    const [notifs, setNotifs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    
    useEffect(() => {
      api.getNotifications()
        .then(n => setNotifs(Array.isArray(n) ? n : []))
        .catch(() => setNotifs([]))
        .finally(() => setLoading(false));
    }, []);
    
    const types = ["all", "announcement", "notice", "alert", "attendance", "grade", "fee"];
    const filtered = notifs.filter(n => filter === "all" || n.type === filter);
    const unread = notifs.filter(n => !n.isRead).length;
    
    return (
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          <StatCard label="Total Notifications" value={notifs.length} color={C.indigo} icon={<Bell size={15}/>} delay={0}/>
          <StatCard label="Unread" value={unread} color={C.rose} icon={<AlertCircle size={15}/>} delay={0.05}/>
          <StatCard label="High Priority" value={notifs.filter(n => n.priority === "high").length} color={C.orange} icon={<AlertTriangle size={15}/>} delay={0.1}/>
        </div>
        
        <Card style={{padding:14}}>
          <div style={{display:"flex",gap:3,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:3}}>
            {types.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",fontFamily:F,transition:"all 0.14s",background:filter === t ? C.indigo : "transparent",color:filter === t ? "#fff" : C.txt2}}>
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </Card>
        
        {loading ? (
          <div style={{padding:40,textAlign:"center"}}><Loader size={18} color={C.indigo} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto"}}/></div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
            {filtered.length === 0 ? (
              <Card style={{padding:40,textAlign:"center",gridColumn:"1 / -1"}}><Bell size={30} style={{color:C.txt2,opacity:0.18,display:"block",margin:"0 auto 12px"}}/><div style={{color:C.txt2}}>No notifications yet</div></Card>
            ) : (
              filtered.map((n,i) => (
                <motion.div key={n._id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}>
                  <Card style={{padding:14,borderLeft:`4px solid ${n.priority === "high" ? C.rose : n.priority === "normal" ? C.indigo : C.txt2}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{n.title}</div>
                        <div style={{fontSize:10,color:C.txt2}}>{fmt(n.sentAt)}</div>
                      </div>
                      {!n.isRead && <div style={{width:8,height:8,borderRadius:"50%",background:C.indigo}}/>}
                    </div>
                    <div style={{fontSize:12,color:C.txt2,lineHeight:1.5,marginBottom:8}}>{n.message}</div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10,fontWeight:700,background:`${n.priority === "high" ? C.rose : n.priority === "normal" ? C.indigo : C.cyan}20`,color:n.priority === "high" ? C.rose : n.priority === "normal" ? C.indigo : C.cyan,padding:"2px 8px",borderRadius:4}}>{n.priority}</span>
                      <span style={{fontSize:10,fontWeight:700,background:`${C.violet}20`,color:C.violet,padding:"2px 8px",borderRadius:4}}>{n.type}</span>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const pageTitles={dashboard:"My Dashboard",attendance:"My Attendance",grades:"My Grades",leaves:"Leave Requests",fees:"My Fees",timetable:"Timetable",announcements:"Notices",classes:"My Classes",notifications:"Notifications"};

  const renderPage=()=>{
    if(loading) return <div style={{padding:60,textAlign:"center",color:C.txt2}}><Loader size={24} color={C.violet} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 12px"}}/>Loading…</div>;
    switch(view){
      case "dashboard":     return <StudentOverview/>;
      case "attendance":    return <StudentAttendancePage/>;
      case "classes":       return <StudentClasses/>;
      case "grades":        return <GradesPage students={[student]} api={api} toast={toast} isAdmin={false}/>;
      case "leaves":        return <StudentLeaves/>;
      case "fees":          return <FeesPage students={[student]} api={api} toast={toast} studentId={sid} isAdmin={false}/>;
      case "timetable":     return <TimetablePage api={api} toast={toast} isAdmin={false}/>;
      case "notifications": return <StudentNotifications/>;
      case "announcements": return <AnnouncementsPage isAdmin={false} api={api} toast={toast}/>;
      default:              return <StudentOverview/>;
    }
  };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:F,color:C.txt}}>
      <Sidebar nav={studentNav} active={view} setActive={setView} user={{name:student.name,role:`Roll #${student.rollNo}`}} onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <TopBar title={pageTitles[view]||"Student Portal"} theme={theme} onToggleSidebar={()=>setCollapsed(p=>!p)} actions={<ThemeSwitcher theme={theme} setTheme={setTheme}/>}/>
        <div style={{flex:1,padding:"24px 28px",overflowY:"auto"}}>
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.2}}>
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {toastEl}
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  LOGIN — AUTH FIELD (icon input with animated focus ring)
// ══════════════════════════════════════════════════════
const AuthField = ({icon:Icon, label, error, endAdornment, wrapStyle={}, theme, accent, ...p}) => {
  const [focused,setFocused]=useState(false);
  const C = themes[theme] || themes.dark;
  const A = accent || C.indigo;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:7}}>
      {label && <div style={{fontSize:10,fontWeight:800,color:focused?A:C.txt2,letterSpacing:1.2,textTransform:'uppercase',transition:'color 0.2s'}}>{label}</div>}
      <div style={{position:'relative',display:'flex',alignItems:'center',borderRadius:13,
        border:`1.5px solid ${error?C.rose:focused?A:C.border}`,
        background:focused?`${A}0c`:'rgba(127,127,127,0.045)',
        boxShadow:focused?`0 0 0 4px ${A}1c`:'none',
        transition:'border-color 0.2s, box-shadow 0.25s, background 0.2s',...wrapStyle}}>
        {Icon && <Icon size={16} style={{position:'absolute',left:14,color:focused?A:C.txt2,transition:'color 0.2s'}}/>}
        <input {...p}
          onFocus={e=>{setFocused(true);p.onFocus&&p.onFocus(e);}}
          onBlur={e=>{setFocused(false);p.onBlur&&p.onBlur(e);}}
          style={{background:'transparent',border:'none',outline:'none',color:C.txt,fontFamily:F,
            fontSize:14,fontWeight:600,padding:`13px 14px 13px ${Icon?42:14}px`,width:'100%',boxSizing:'border-box'}}/>
        {endAdornment}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════
// Brand palette pulled from the ACADEXA crest (deep violet + gold) — used only
// for this page's accents so the login screen reads as custom-branded rather
// than a generic indigo/cyan SaaS template.
const B = {
  violet:'#7c3aed', violetLt:'#a78bfa', violetDp:'#4c1d95',
  gold:'#d4af37', goldLt:'#f3d78a',
  ink:'#0b0716',
};

const Login = ({onLogin, theme, setTheme}) => {
  const C = themes[theme] || themes.dark;
  const api = useMemo(()=>makeApi(null),[]);
  const [role,setRole]=useState("student");
  const [roll,setRoll]=useState("");
  const [pass,setPass]=useState("");
  const [email,setEmail]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [showPass,setShowPass]=useState(false);
  const [capsLock,setCapsLock]=useState(false);
  const [shake,setShake]=useState(false);

  const triggerShake=()=>{setShake(true);setTimeout(()=>setShake(false),420);};

  const submit=async()=>{
    setError("");
    if(role==='student' && !roll.trim()){setError("Please enter your roll number.");triggerShake();return;}
    if(role==='admin' && !email.trim()){setError("Please enter your email address.");triggerShake();return;}
    if(!pass){setError("Please enter your password.");triggerShake();return;}
    setLoading(true);
    try{
      let data;
      if(role==="admin") data=await api.adminLogin(email,pass);
      else               data=await api.studentLogin(roll,pass);
      onLogin(data);
    }catch(e){setError(e.message);triggerShake();}
    finally{setLoading(false);}
  };

  const handleKeyDown=e=>{ if(e.key==='Enter') submit(); };
  const watchCapsLock=e=>{ if(e.getModifierState) setCapsLock(e.getModifierState('CapsLock')); };

  const features=[
    {icon:Activity,label:'Live Attendance'},
    {icon:Award,label:'Grade Tracking'},
    {icon:Bell,label:'Instant Notices'},
    {icon:CreditCard,label:'Fee Management'},
  ];

  const isDark = theme!=='light';

  return (
    <div style={{fontFamily:F,background:C.bg,color:C.txt}}>
      <style>{`
        .authWrap{display:flex;min-height:100vh}
        @media (max-width:980px){.authWrap{flex-direction:column}}

        /* ── Brand panel (left) ───────────────────────── */
        .brandPanel{flex:0 0 42%;position:relative;min-height:100vh;overflow:hidden;display:flex;flex-direction:column;background:${C.bg2}}
        @media (max-width:980px){.brandPanel{flex:0 0 auto;min-height:240px}}
        .campusImage{position:absolute;inset:0;background-image:url('/assets/campus-photo.png');background-position:center 65%;background-size:cover;transform-origin:center;animation:kbZoom 26s ease-in-out infinite alternate}
        .campusOverlay{position:absolute;inset:0;background:linear-gradient(195deg,rgba(24,10,48,0.4) 0%,rgba(18,7,38,0.6) 38%,rgba(11,6,22,0.94) 82%,rgba(8,4,16,0.98) 100%)}
        .campusOverlay2{position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,6,22,0.55) 0%,transparent 45%)}
        .heroOrb{position:absolute;border-radius:50%;filter:blur(90px);z-index:1;pointer-events:none}
        .heroOrb1{width:280px;height:280px;background:${B.violet};opacity:0.35;bottom:-60px;left:-60px;animation:floatSlow 12s ease-in-out infinite}
        .heroOrb2{width:220px;height:220px;background:${B.gold};opacity:0.18;top:-60px;right:-50px;animation:floatSlow 15s ease-in-out infinite reverse}
        .brandInner{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;color:#fff;padding:44px 44px 32px}
        @media (max-width:980px){.brandInner{padding:26px 26px 20px}}
        .brandTop{display:flex;align-items:center;gap:10px}
        .brandLogoBadge{width:40px;height:40px;border-radius:10px;background:${B.ink};border:1px solid ${B.gold}55;box-shadow:0 4px 14px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
        .brandWordmark{font-size:13px;font-weight:800;letter-spacing:1.2px;color:rgba(255,255,255,0.96)}
        .brandWordmark small{display:block;font-size:10px;font-weight:600;letter-spacing:1.4px;color:${B.goldLt};text-transform:uppercase;margin-top:1px}
        .brandBody{flex:1;display:flex;flex-direction:column;justify-content:flex-end;max-width:460px}
        @media (max-width:980px){.brandBody{display:none}}
        .eyebrow{display:inline-flex;align-items:center;gap:6px;padding:5px 12px 5px 10px;border-radius:100px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.3);font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${B.goldLt};margin-bottom:18px;width:fit-content}
        .heading{font-size:34px;font-weight:800;line-height:1.16;margin-bottom:14px;letter-spacing:-0.6px}
        .headingAccent{background:linear-gradient(120deg,${B.violetLt},${B.goldLt});-webkit-background-clip:text;background-clip:text;color:transparent}
        .sub{color:rgba(255,255,255,0.72);font-size:14.5px;line-height:1.65;max-width:400px}
        .featureList{display:flex;flex-direction:column;gap:13px;margin-top:30px}
        .featureItem{display:flex;align-items:center;gap:12px}
        .featureIconBox{width:32px;height:32px;border-radius:10px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.22);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .featureText{font-size:13px;font-weight:600;color:rgba(255,255,255,0.85)}
        .brandFooter{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;margin-top:32px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.12);font-size:11.5px;color:rgba(255,255,255,0.5)}
        @media (max-width:980px){.brandFooter{display:none}}
        .brandFooter span{display:inline-flex;align-items:center;gap:6px}

        /* ── Form panel (right) ───────────────────────── */
        .formPanel{flex:1;position:relative;display:flex;align-items:center;justify-content:center;padding:64px 32px;background:${C.bg}}
        @media (max-width:980px){.formPanel{flex-direction:column;padding:28px 20px 76px}}
        .formAmbient{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
        .cardOrb{position:absolute;border-radius:50%;filter:blur(80px)}
        .cardOrb1{width:320px;height:320px;background:${B.violet};opacity:${isDark?0.16:0.09};top:-10%;right:-8%}
        .cardOrb2{width:260px;height:260px;background:${B.gold};opacity:${isDark?0.09:0.05};bottom:-8%;left:-6%}
        .formThemeToggle{position:absolute;top:24px;right:28px;z-index:3}
        @media (max-width:980px){.formThemeToggle{position:static;align-self:flex-end;margin-bottom:14px}}
        .formCenter{position:relative;z-index:2;width:100%;display:flex;justify-content:center}
        @media (max-width:980px){.formCenter{width:100%}}

        .loginCard{position:relative;width:100%;max-width:412px;background:${C.surface};border-radius:22px;padding:38px 34px 32px;box-shadow:0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 60px rgba(2,3,12,0.2);border:1px solid ${C.border};overflow:hidden}
        .cardAccentBar{position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${B.violetDp},${B.gold},${B.violet})}
        .loginCardHeader{display:flex;align-items:center;gap:12px;margin-bottom:22px}
        .loginCardTitle{font-size:19px;font-weight:900;color:${C.txt};margin-bottom:3px;display:flex;align-items:center;gap:7px}
        .loginCardSubtitle{font-size:12.5px;color:${C.txt2};line-height:1.5}
        .segmented{position:relative;display:flex;background:rgba(127,127,127,0.07);border-radius:13px;padding:4px;border:1px solid ${C.border};width:100%}
        .segThumb{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:9px;background:linear-gradient(135deg,${B.violetDp},${B.violet});box-shadow:0 4px 14px ${B.violet}55;z-index:0}
        .segBtn{position:relative;z-index:1;flex:1;padding:10px 14px;border-radius:9px;border:none;background:transparent;cursor:pointer;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;gap:7px;transition:color 0.2s;font-family:${F}}
        .fieldStack{display:flex;flex-direction:column;gap:15px;margin-top:20px}
        .shakeWrap{animation:none}
        .shakeWrap.shaking{animation:shakeX 0.42s ease}
        .capsWarn{display:flex;align-items:center;gap:6px;font-size:11px;color:${C.amber};font-weight:700;margin-top:6px}
        .submitBtnWrap{position:relative;border-radius:13px;overflow:hidden;margin-top:4px}
        .submitBtnWrap::after{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent,rgba(255,255,255,0.25),transparent);transform:translateX(-120%);transition:transform 0.6s}
        .submitBtnWrap:hover::after{transform:translateX(120%)}
        .trustRow{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:22px;padding-top:16px;border-top:1px solid ${C.border}}
        .trustItem{display:flex;align-items:center;gap:6px;font-size:10.5px;color:${C.txt2};font-weight:600}
        .cardFooter{text-align:center;margin-top:14px;font-size:11px;color:${C.txt2}}

        @keyframes kbZoom{0%{transform:scale(1.03)}100%{transform:scale(1.13)}}
        @keyframes floatSlow{0%,100%{transform:translate(0,0)}50%{transform:translate(18px,-16px)}}
        @keyframes shakeX{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-7px)}40%,60%{transform:translateX(7px)}}
      `}</style>

      <div className="authWrap">
        {/* ── Left: brand / hero ───────────────────────── */}
        <div className="brandPanel" aria-hidden="true">
          <div className="campusImage"/>
          <div className="campusOverlay"/>
          <div className="campusOverlay2"/>
          <div className="heroOrb heroOrb1"/>
          <div className="heroOrb heroOrb2"/>

          <div className="brandInner">
            <div className="brandTop">
              <div className="brandLogoBadge">
                <img src="/assets/acadexa-crest.png" alt="ACADEXA" style={{height:'100%',width:'100%',objectFit:'cover'}} />
              </div>
              <div className="brandWordmark">ACADEXA<small>by ASAD</small></div>
            </div>

            <div className="brandBody">
              <div className="eyebrow"><Sparkles size={11}/> Academic Management Platform</div>
              <div className="heading">A Smarter <span className="headingAccent">Academic Experience</span> Begins Here</div>
              <div className="sub">Secure, modern, and intuitive workflows for students and administrators — all in one place.</div>

              <div className="featureList">
                {features.map((f,i)=>{
                  const Icon=f.icon;
                  return (
                    <motion.div key={f.label} className="featureItem" initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{delay:0.15+i*0.08,duration:0.4}}>
                      <div className="featureIconBox"><Icon size={15} color={B.goldLt}/></div>
                      <div className="featureText">{f.label}</div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="brandFooter">
                <span><ShieldCheck size={12}/> Empowering students. Connecting education.</span>
                <span>© 2026 ACADEXA</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: sign-in form ──────────────────────── */}
        <div className="formPanel">
          <div className="formAmbient">
            <div className="cardOrb cardOrb1"/>
            <div className="cardOrb cardOrb2"/>
          </div>

          <div className="formThemeToggle"><ThemeSwitcher theme={theme} setTheme={setTheme}/></div>

          <div className="formCenter">
            <motion.div initial={{opacity:0,y:14,scale:0.98}} animate={{opacity:1,y:0,scale:1}} transition={{duration:0.5,ease:'easeOut'}} style={{width:'100%',maxWidth:412}}>
              <div className={`loginCard shakeWrap ${shake?'shaking':''}`}>
                <div className="cardAccentBar"/>
                <div className="loginCardHeader">
                  <div style={{width:46,height:46,borderRadius:13,background:B.ink,border:`1px solid ${B.gold}55`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 8px 22px rgba(0,0,0,0.3)`,flexShrink:0,overflow:'hidden'}}>
                    <img src="/assets/acadexa-crest.png" alt="ACADEXA" style={{height:'100%',width:'100%',objectFit:'cover'}} onError={(e)=>{e.currentTarget.style.display='none';}} />
                  </div>
                  <div>
                    <div className="loginCardTitle">Welcome Back <Fingerprint size={15} color={B.violet}/></div>
                    <div className="loginCardSubtitle">Sign in to access your ACADEXA dashboard</div>
                  </div>
                </div>

                <div className="segmented">
                  <motion.div className="segThumb" animate={{x: role==='admin' ? '100%' : '0%'}} transition={{type:'spring',stiffness:500,damping:34}}/>
                  {[{k:'student',label:'Student',icon:User},{k:'admin',label:'Admin',icon:Shield}].map(s=>{
                    const Icon=s.icon;
                    const active=role===s.k;
                    return (
                      <button key={s.k} onClick={()=>{setRole(s.k);setError('');}} className="segBtn" style={{color:active?"#fff":C.txt2}}>
                        <Icon size={14}/>{s.label}
                      </button>
                    );
                  })}
                </div>

              <AnimatePresence mode="wait">
                <motion.div key={role} initial={{opacity:0,x:role==='admin'?12:-12}} animate={{opacity:1,x:0}} transition={{duration:0.25}} className="fieldStack">
                  {role==='student' ? (
                    <AuthField theme={theme} accent={B.violet} icon={Hash} label="Roll Number" placeholder="e.g. CS-101" value={roll} onChange={e=>setRoll(e.target.value)} onKeyDown={handleKeyDown} autoFocus />
                  ) : (
                    <AuthField theme={theme} accent={B.violet} icon={Mail} label="Email address" type="email" placeholder="admin@university.edu" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKeyDown} autoFocus />
                  )}

                  <div>
                    <AuthField theme={theme} accent={B.violet} icon={Lock} label="Password" type={showPass?"text":"password"} placeholder="Enter password"
                      value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={handleKeyDown} onKeyUp={watchCapsLock}
                      wrapStyle={{paddingRight:0}}
                      endAdornment={
                        <button type="button" onClick={()=>setShowPass(!showPass)} style={{position:'absolute',right:12,background:'none',border:'none',cursor:'pointer',color:showPass?B.violet:C.txt2,display:'flex',padding:6}}>
                          {showPass?<Eye size={17}/>:<EyeOff size={17}/>}
                        </button>
                      }/>
                    <AnimatePresence>
                      {capsLock && (
                        <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="capsWarn">
                          <AlertTriangle size={12}/> Caps Lock is on
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{display:'flex',gap:10,alignItems:'center',background:`rgba(244,63,94,0.08)`,border:`1px solid rgba(244,63,94,0.22)`,padding:'10px 12px',borderRadius:10}}>
                        <AlertTriangle size={16} color={C.rose}/>
                        <div style={{fontSize:13,color:C.rose,fontWeight:600}}>{error}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="submitBtnWrap">
                    <Btn full size="lg" onClick={submit} disabled={loading}
                      style={{background:`linear-gradient(135deg,${B.violetDp},${B.violet})`,boxShadow:`0 6px 24px ${B.violet}45`}}>
                      {loading ? <><Loader size={15} style={{animation:'spin 1s linear infinite'}}/>Signing in…</> : <><Zap size={15}/>Sign In</>}
                    </Btn>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="trustRow">
                <div className="trustItem"><ShieldCheck size={13} color={C.emerald}/> Encrypted session</div>
                <div className="trustItem"><Lock size={13}/> No data stored locally</div>
              </div>

                <div className="cardFooter">© 2026 ACADEXA by ASAD</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
//  ROOT — session lives ONLY in React state, zero storage
// ══════════════════════════════════════════════════════
export default function App() {
  const [theme,setTheme] = useState("dark");
  const [session,setSession]=useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ name: "", email: "", message: "" });
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const handleLogin=useCallback((data)=>{
    setSession({
      token:   data.token,
      role:    data.role,
      student: data.student||null,
    });
  },[]);

  const logout=useCallback(()=>{
    setSession(null);
  },[]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = window.localStorage.getItem("edu_theme");
      if (savedTheme && themes[savedTheme]) {
        setTheme(savedTheme);
      }
    }
  }, []);

  useEffect(() => {
    C = themes[theme] || themes.dark;
    if (typeof window !== "undefined") {
      document.documentElement.dataset.theme = theme;
      window.localStorage.setItem("edu_theme", theme);
    }
  }, [theme]);

  const handleSubmitFeedback = async () => {
    if (!feedbackForm.name.trim() || !feedbackForm.email.trim() || !feedbackForm.message.trim()) {
      alert("Please fill all fields");
      return;
    }

    setFeedbackLoading(true);
    try {
      const response = await fetch(`${BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: feedbackForm.name,
          email: feedbackForm.email,
          message: feedbackForm.message,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send feedback");

      setFeedbackSuccess(true);
      setFeedbackForm({ name: "", email: "", message: "" });
      setTimeout(() => {
        setFeedbackOpen(false);
        setFeedbackSuccess(false);
      }, 2000);
    } catch (err) {
      alert("Error sending feedback: " + err.message);
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Bebas+Neue&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:${C.bg};font-family:${F};-webkit-font-smoothing:antialiased;padding-bottom:50px;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(108,99,255,0.3);border-radius:4px;}
        input::placeholder,textarea::placeholder{color:${C.txt2};}
        select option{background:${C.surface2};color:${C.txt};}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%{transform:scale(1);opacity:0.6;}100%{transform:scale(2);opacity:0;}}
        .signature-footer{
          position:fixed;
          bottom:0;
          left:0;
          right:0;
          background:linear-gradient(135deg,rgba(108,99,255,0.05) 0%,rgba(139,92,246,0.08) 100%);
          backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
          border-top:1px solid rgba(108,99,255,0.15);
          padding:14px 20px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          font-size:11px;
          color:${C.txt2};
          z-index:1000;
          box-shadow:0 -4px 16px rgba(0,0,0,0.08);
        }
        .signature-name{
          font-weight:700;
          background:linear-gradient(135deg,${C.indigo},${C.purple});
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          letter-spacing:0.6px;
          font-style:italic;
        }
        .signature-email{
          cursor:pointer;
          transition:all 0.3s cubic-bezier(0.4,0,0.2,1);
          padding:6px 12px;
          border-radius:6px;
          text-decoration:none;
          display:flex;
          align-items:center;
          gap:4px;
          color:${C.txt2};
          border:1px solid transparent;
        }
        .signature-email:hover{
          background:rgba(108,99,255,0.2);
          color:${C.indigo};
          border:1px solid rgba(108,99,255,0.3);
          transform:translateY(-1px);
        }
      `}</style>
      <AnimatePresence mode="wait">
        {!session&&(
          <motion.div key="login" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,scale:0.98}}>
            <Login onLogin={handleLogin} theme={theme} setTheme={setTheme}/>
          </motion.div>
        )}
        {session?.role==="admin"&&(
          <motion.div key="admin" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <AdminDashboard token={session.token} onLogout={logout} theme={theme} setTheme={setTheme}/>
          </motion.div>
        )}
        {session?.role==="student"&&session?.student&&(
          <motion.div key="student" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <StudentPortal student={session.student} token={session.token} onLogout={logout} theme={theme} setTheme={setTheme}/>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Modern Signature Footer */}
      <div className="signature-footer">
        <div style={{display:'flex',alignItems:'center',gap:2}}>
          <span style={{fontSize:10,color:C.dim}}>© 2026 Property of Asad ullah</span>
          <span className="signature-name">❋ Asad Ullah Sikandar</span>
        </div>
        <button 
          onClick={() => setFeedbackOpen(true)}
          className="signature-email"
          title="Send feedback"
          style={{textDecoration:'none',display:'flex',alignItems:'center',gap:4,background:'none',border:'none'}}
        >
          <MessageSquare size={12}/> Feedback
        </button>
      </div>

      {/* Feedback Modal */}
      <AnimatePresence>
        {feedbackOpen && (
          <motion.div
            initial={{opacity:0}}
            animate={{opacity:1}}
            exit={{opacity:0}}
            onClick={() => !feedbackLoading && setFeedbackOpen(false)}
            style={{
              position:'fixed',
              inset:0,
              background:'rgba(0,0,0,0.5)',
              backdropFilter:'blur(4px)',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              zIndex:2000
            }}
          >
            <motion.div
              initial={{scale:0.95,opacity:0}}
              animate={{scale:1,opacity:1}}
              exit={{scale:0.95,opacity:0}}
              onClick={(e) => e.stopPropagation()}
              style={{
                background:C.surface2,
                borderRadius:16,
                padding:30,
                maxWidth:500,
                width:'90%',
                maxHeight:'90vh',
                overflow:'auto',
                border:`1px solid ${C.border}`
              }}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <h3 style={{fontSize:20,fontWeight:700,color:C.txt}}>Send Feedback</h3>
                <button
                  onClick={() => setFeedbackOpen(false)}
                  disabled={feedbackLoading}
                  style={{background:'none',border:'none',cursor:'pointer',color:C.txt2,fontSize:20}}
                >
                  ×
                </button>
              </div>

              <AnimatePresence>
                {feedbackSuccess ? (
                  <motion.div
                    initial={{opacity:0,y:10}}
                    animate={{opacity:1,y:0}}
                    exit={{opacity:0}}
                    style={{
                      background:`rgba(34,197,94,0.1)`,
                      border:`1px solid rgba(34,197,94,0.3)`,
                      borderRadius:10,
                      padding:16,
                      textAlign:'center'
                    }}
                  >
                    <div style={{fontSize:40,marginBottom:8}}>✨</div>
                    <p style={{color:C.txt,fontWeight:600,marginBottom:4}}>Thank you for your feedback!</p>
                    <p style={{fontSize:12,color:C.txt2}}>We appreciate your input and will review it shortly.</p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{opacity:0}}
                    animate={{opacity:1}}
                    exit={{opacity:0}}
                    style={{display:'flex',flexDirection:'column',gap:16}}
                  >
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:C.txt2,display:'block',marginBottom:6}}>Full Name</label>
                      <input
                        type="text"
                        placeholder="Your name"
                        value={feedbackForm.name}
                        onChange={(e) => setFeedbackForm({...feedbackForm, name: e.target.value})}
                        disabled={feedbackLoading}
                        style={{
                          width:'100%',
                          padding:'10px 14px',
                          background:C.surface,
                          border:`1px solid ${C.border}`,
                          borderRadius:8,
                          color:C.txt,
                          fontSize:13,
                          fontFamily:F,
                          outline:'none',
                          transition:'all 0.3s',
                          disabled: feedbackLoading ? 0.5 : 1
                        }}
                        onFocus={(e) => e.target.style.borderColor = C.indigo}
                        onBlur={(e) => e.target.style.borderColor = C.border}
                      />
                    </div>

                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:C.txt2,display:'block',marginBottom:6}}>Email Address</label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={feedbackForm.email}
                        onChange={(e) => setFeedbackForm({...feedbackForm, email: e.target.value})}
                        disabled={feedbackLoading}
                        style={{
                          width:'100%',
                          padding:'10px 14px',
                          background:C.surface,
                          border:`1px solid ${C.border}`,
                          borderRadius:8,
                          color:C.txt,
                          fontSize:13,
                          fontFamily:F,
                          outline:'none',
                          transition:'all 0.3s',
                          opacity: feedbackLoading ? 0.5 : 1
                        }}
                        onFocus={(e) => e.target.style.borderColor = C.indigo}
                        onBlur={(e) => e.target.style.borderColor = C.border}
                      />
                    </div>

                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:C.txt2,display:'block',marginBottom:6}}>Your Feedback</label>
                      <textarea
                        placeholder="Tell us what you think... (minimum 10 characters)"
                        value={feedbackForm.message}
                        onChange={(e) => setFeedbackForm({...feedbackForm, message: e.target.value})}
                        disabled={feedbackLoading}
                        style={{
                          width:'100%',
                          padding:'12px 14px',
                          background:C.surface,
                          border:`1px solid ${C.border}`,
                          borderRadius:8,
                          color:C.txt,
                          fontSize:13,
                          fontFamily:F,
                          outline:'none',
                          minHeight:120,
                          resize:'vertical',
                          transition:'all 0.3s',
                          opacity: feedbackLoading ? 0.5 : 1
                        }}
                        onFocus={(e) => e.target.style.borderColor = C.indigo}
                        onBlur={(e) => e.target.style.borderColor = C.border}
                      />
                      <p style={{fontSize:10,color:C.txt2,marginTop:4}}>{feedbackForm.message.length} characters</p>
                    </div>

                    <div style={{display:'flex',gap:10,marginTop:10}}>
                      <button
                        onClick={() => setFeedbackOpen(false)}
                        disabled={feedbackLoading}
                        style={{
                          flex:1,
                          padding:'10px 16px',
                          background:C.surface,
                          border:`1px solid ${C.border}`,
                          borderRadius:8,
                          color:C.txt,
                          fontWeight:600,
                          cursor:'pointer',
                          transition:'all 0.3s',
                          opacity:feedbackLoading ? 0.5 : 1,
                          pointerEvents:feedbackLoading ? 'none' : 'auto'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitFeedback}
                        disabled={feedbackLoading}
                        style={{
                          flex:1,
                          padding:'10px 16px',
                          background: feedbackLoading ? C.purple : C.indigo,
                          border:'none',
                          borderRadius:8,
                          color:'white',
                          fontWeight:600,
                          cursor:feedbackLoading ? 'not-allowed' : 'pointer',
                          transition:'all 0.3s',
                          display:'flex',
                          alignItems:'center',
                          justifyContent:'center',
                          gap:8,
                          opacity:feedbackLoading ? 0.7 : 1
                        }}
                      >
                        {feedbackLoading ? (
                          <><Loader size={14} style={{animation:'spin 1s linear infinite'}}/> Sending...</>
                        ) : (
                          <><Send size={14}/> Send Feedback</>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}