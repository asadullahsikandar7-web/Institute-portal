import { SectionHeader, Card, Icon } from "../../components/ui/index.js";

// The AI assistant itself lives as a floating widget mounted on every page
// (see components/AIWidget.jsx) so it's reachable from anywhere, not just
// this one page — this route just explains that and points at it.
export default function AIPage() {
  return (
    <>
      <SectionHeader eyebrow="Assistant" title="AI Assistant" />
      <Card style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="bot" size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>ACADEXA Assistant is one click away</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Open the AI button floating in the bottom-right corner of any page to chat, ask about your data, or dictate with voice.
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
