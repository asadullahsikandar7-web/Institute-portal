import { useState } from "react";
import { SectionHeader, Tabs } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import GradeReport from "../shared/GradeReport.jsx";
import { MyTranscript } from "../erp/ResultsPages.jsx";

// "Transcript" is the official record (published course results, GPA and
// CGPA). "Test Marks" is the older per-exam grade list, kept as-is.
export default function StudentResultsPage() {
  const { session } = useSession();
  const [tab, setTab] = useState("transcript");
  return (
    <>
      <SectionHeader eyebrow="Academics" title="Results" />
      <Tabs items={[{ key: "transcript", label: "Transcript & GPA" }, { key: "marks", label: "Test Marks" }]} active={tab} onChange={setTab} style={{ marginBottom: 18 }} />
      {tab === "transcript" ? <MyTranscript /> : <GradeReport student={session.student} isAdmin={false} />}
    </>
  );
}
