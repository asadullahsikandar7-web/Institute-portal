import Portal from "./Portal.jsx";
import Icon from "./Icon.jsx";

export default function Drawer({ title, subtitle, onClose, children }) {
  return (
    <Portal>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="modal-head">
          <div>
            <h3 className="font-display" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h3>
            {subtitle && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: 22 }}>{children}</div>
      </div>
    </Portal>
  );
}
