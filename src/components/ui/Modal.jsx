import Portal from "./Portal.jsx";
import Icon from "./Icon.jsx";

export default function Modal({ title, onClose, children, footer, wide }) {
  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={"modal" + (wide ? " wide" : "")}>
          <div className="modal-head">
            <h3 className="font-display" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h3>
            <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
