import { SectionHeader, Card, EmptyState } from "./ui/index.js";

// Placeholder for pages not yet ported in this phase of the rebuild — real
// data/logic for these still lives in src/asad.jsx and will move here
// page-by-page in the phases that follow (see the rebuild plan). Never
// fabricates data; just says what's pending.
export default function ComingSoonPage({ eyebrow, title, note }) {
  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} />
      <Card style={{ padding: 24 }}>
        <EmptyState icon="clipboard" title="Being rebuilt" desc={note || "This page is being ported to the new design in an upcoming phase."} />
      </Card>
    </>
  );
}
