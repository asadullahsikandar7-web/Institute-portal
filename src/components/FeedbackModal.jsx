import { useState } from "react";
import { Modal, Btn, Icon } from "./ui/index.js";
import { useSession } from "../context/SessionContext.jsx";

export default function FeedbackModal({ onClose }) {
  const { anonApi } = useSession();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || form.message.trim().length < 10) {
      setError("Please fill every field (message needs at least 10 characters).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await anonApi.sendFeedback(form);
      setSuccess(true);
      setForm({ name: "", email: "", message: "" });
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err.message || "Failed to send feedback");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Send Feedback" onClose={onClose} footer={!success && (
      <>
        <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancel</Btn>
        <Btn variant="accent" onClick={submit} disabled={loading}>{loading ? "Sending…" : "Send Feedback"}</Btn>
      </>
    )}>
      {success ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>✨</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Thank you for your feedback!</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>We appreciate your input and will review it shortly.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label className="field-label">Full Name</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={loading} />
          </div>
          <div>
            <label className="field-label">Email Address</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={loading} />
          </div>
          <div>
            <label className="field-label">Your Feedback</label>
            <textarea className="input" rows={4} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} disabled={loading} />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{form.message.length} characters</div>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}><Icon name="alert" size={14} />{error}</div>}
        </div>
      )}
    </Modal>
  );
}
