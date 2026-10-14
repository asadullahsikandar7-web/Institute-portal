import { createContext, useCallback, useContext, useState } from "react";
import Icon from "../components/ui/Icon.jsx";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((msg, icon) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, icon }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div className="toast" key={t.id}><Icon name={t.icon || "check"} size={15} />{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// Returns a `toast(msg, icon?)` function — replaces every page's own
// `const [toast, showToast] = useToast()` local instance from the monolith
// with one shared, app-wide toast stack.
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
