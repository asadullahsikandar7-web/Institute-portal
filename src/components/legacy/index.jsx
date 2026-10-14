// Verbatim ports of the original asad.jsx primitives (Avatar/Card/Btn/Input/
// Toast/useToast), kept only so Chat.jsx and AI.jsx keep working unmodified
// until Phase 7 reskins them. Do not use these in any new/rebuilt page —
// use src/components/ui/* instead. See src/styles/legacyTokens.js.
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, X } from "lucide-react";
import { C, F } from "../../styles/legacyTokens.js";

export const Avatar = ({ name, size = 38, color = C.indigo, img }) => {
  const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      background: `linear-gradient(135deg,${color}44,${color}18)`, border: `1.5px solid ${color}33`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: size * 0.34, color, fontFamily: F, letterSpacing: 0.5 }}>
      {img ? <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={name} /> : initials}
    </div>
  );
};

export const Card = ({ children, style = {}, hover = false, glow = false, onClick }) => (
  <motion.div
    whileHover={hover || onClick ? { y: -2, boxShadow: `0 10px 24px -10px rgba(4,3,1,0.32), 0 0 0 1px ${C.borderMd}` } : {}}
    onClick={onClick}
    style={{
      background: C.surface,
      border: `1px solid ${glow ? C.borderMd : C.border}`, borderRadius: 14,
      boxShadow: glow
        ? `0 0 0 1px ${C.indigo}30, 0 14px 32px -16px ${C.indigo}25`
        : `0 6px 18px -12px rgba(4,3,1,0.3)`,
      cursor: onClick ? "pointer" : "default", transition: "border-color 0.25s, box-shadow 0.25s, transform 0.25s", ...style
    }}>{children}</motion.div>
);

export const Btn = ({ children, variant = "primary", size = "md", onClick, disabled, full, style = {} }) => {
  const V = {
    primary: { bg: `linear-gradient(135deg,${C.indigo},${C.indigoLt})`, color: "#12100a", border: "none", shadow: `0 3px 14px ${C.indigo}30`, hoverShadow: `0 6px 22px ${C.indigo}45`, sheen: true },
    teal: { bg: `linear-gradient(135deg,${C.cyan},${C.sky})`, color: "#0a1418", border: "none", shadow: `0 3px 14px ${C.cyan}28`, hoverShadow: `0 6px 22px ${C.cyan}42`, sheen: true },
    ghost: { bg: "rgba(127,127,127,0.07)", color: C.txt2, border: `1px solid ${C.border}`, shadow: "none", hoverShadow: "none" },
    danger: { bg: `${C.rose}18`, color: C.rose, border: `1px solid ${C.rose}30`, shadow: "none", hoverShadow: "none" },
    success: { bg: `${C.emerald}18`, color: C.emerald, border: `1px solid ${C.emerald}30`, shadow: "none", hoverShadow: "none" },
    amber: { bg: `${C.amber}18`, color: C.amber, border: `1px solid ${C.amber}30`, shadow: "none", hoverShadow: "none" },
  };
  const v = V[variant] || V.primary;
  return (
    <motion.button whileHover={disabled ? {} : { scale: 1.02, y: -1, boxShadow: v.hoverShadow }} whileTap={disabled ? {} : { scale: 0.97 }}
      onClick={disabled ? undefined : onClick}
      style={{ position: "relative", overflow: "hidden", background: v.bg, border: v.border, color: v.color, borderRadius: 8,
        padding: size === "xs" ? "5px 10px" : size === "sm" ? "7px 14px" : size === "lg" ? "12px 28px" : "9px 18px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: size === "xs" ? 10 : size === "sm" ? 12 : 14, fontWeight: 600, fontFamily: F,
        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
        opacity: disabled ? 0.45 : 1, boxShadow: v.shadow,
        width: full ? "100%" : "auto", justifyContent: full ? "center" : "flex-start",
        transition: "box-shadow 0.2s", ...style }}>
      {v.sheen && !disabled && (
        <motion.span aria-hidden initial={{ x: "-120%" }} whileHover={{ x: "220%" }} transition={{ duration: 0.7, ease: "easeInOut" }}
          style={{ position: "absolute", top: 0, left: 0, width: "40%", height: "100%", pointerEvents: "none",
            background: "linear-gradient(115deg,transparent,rgba(255,255,255,0.3),transparent)", transform: "skewX(-18deg)" }} />
      )}
      {children}
    </motion.button>
  );
};

export const Input = ({ style = {}, label, ...p }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <div style={{ fontSize: 10, fontWeight: 600, color: C.txt2, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>}
    <input {...p} style={{ background: "rgba(127,127,127,0.05)", border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "10px 14px", color: C.txt, fontFamily: F, fontSize: 14,
      outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color 0.2s, box-shadow 0.2s", ...style }}
      onFocus={e => { e.target.style.borderColor = C.indigo; e.target.style.boxShadow = `0 0 0 3px ${C.indigo}22`; }}
      onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }} />
  </div>
);

const Toast = ({ msg, type, onClose }) => (
  <motion.div initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60 }}
    style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: C.surface,
      border: `1px solid ${type === "success" ? C.emerald : C.rose}44`,
      borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
      maxWidth: 380, fontFamily: F, boxShadow: "0 10px 30px -10px rgba(4,3,1,0.4)" }}>
    {type === "success" ? <CheckCircle size={16} color={C.emerald} /> : <AlertCircle size={16} color={C.rose} />}
    <span style={{ fontSize: 13, color: C.txt, flex: 1, lineHeight: 1.4 }}>{msg}</span>
    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.txt2, display: "flex" }}><X size={13} /></button>
  </motion.div>
);

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = "error") => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  }, []);
  const el = toast && <AnimatePresence><Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={() => setToast(null)} /></AnimatePresence>;
  return [el, show];
}
