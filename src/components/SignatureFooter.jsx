import { useState } from "react";
import { Icon } from "./ui/index.js";
import FeedbackModal from "./FeedbackModal.jsx";

export default function SignatureFooter() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  return (
    <>
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 10, fontSize: 11, color: "var(--muted)", zIndex: 90,
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>© 2026 Property of Asad Ullah Sikandar</span>
        <button
          onClick={() => setFeedbackOpen(true)}
          className="icon-btn"
          style={{ width: "auto", height: "auto", padding: "6px 10px", gap: 6, fontSize: 11, fontWeight: 600 }}
        >
          <Icon name="message" size={12} /> Feedback
        </button>
      </div>
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}
