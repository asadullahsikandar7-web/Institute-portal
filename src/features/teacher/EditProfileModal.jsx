import { useRef, useState } from "react";
import { Modal, Btn, Icon, Avatar } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

// Self-service — always hits /api/teacher/me (never /api/teachers/:id), so
// a teacher can only ever edit their own name/photo. See
// teacherPortalRoute.js for the matching backend scoping.
export default function EditProfileModal({ onClose }) {
  const { session, api, updateProfile } = useSession();
  const toast = useToast();
  const teacher = session.teacher;
  const fileRef = useRef(null);

  const [name, setName] = useState(teacher?.name || "");
  const [preview, setPreview] = useState(teacher?.photo || null);
  const [file, setFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickFile = () => fileRef.current?.click();

  const onFileChange = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Please choose an image file");
    if (f.size > 2 * 1024 * 1024) return toast("Photo is too large — max 2 MB");
    setFile(f);
    setRemovePhoto(false);
    setPreview(URL.createObjectURL(f));
  };

  const clearPhoto = () => {
    setFile(null);
    setPreview(null);
    setRemovePhoto(true);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return toast("Name must be at least 2 characters");
    setSaving(true);
    try {
      if (trimmed !== teacher?.name) {
        const { teacher: updated } = await api.updateMyTeacherProfile({ name: trimmed });
        updateProfile("teacher", { name: updated.name });
      }
      if (file) {
        const { teacher: updated } = await api.uploadMyTeacherPhoto(file);
        updateProfile("teacher", { photo: updated.photo });
      } else if (removePhoto && teacher?.photo) {
        const { teacher: updated } = await api.deleteMyTeacherPhoto();
        updateProfile("teacher", { photo: updated.photo });
      }
      toast("Profile updated", "check");
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit Profile" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Btn>
    </>}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <div style={{ position: "relative" }}>
          <Avatar name={name || "?"} size={84} img={preview || undefined} />
          <button
            onClick={pickFile}
            title="Change photo"
            style={{
              position: "absolute", bottom: -2, right: -2, width: 30, height: 30, borderRadius: "50%",
              background: "var(--accent)", color: "#1a1204", border: "2px solid var(--surface)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <Icon name="camera" size={14} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
        </div>
        {preview && (
          <button onClick={clearPhoto} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px", color: "var(--danger)" }}>
            <Icon name="x" size={12} />Remove Photo
          </button>
        )}
      </div>

      <label className="field-label">Full Name</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus />
    </Modal>
  );
}
