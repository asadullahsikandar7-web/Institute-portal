import { createPortal } from "react-dom";

export default function Portal({ children }) {
  return typeof document !== "undefined" ? createPortal(children, document.body) : null;
}
