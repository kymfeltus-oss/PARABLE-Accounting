import type { Metadata } from "next";
import OperationsDashboard from "@/components/dashboard/OperationsDashboard";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Operations | PARABLE",
  description: "Ministry operations: accounting, reporting, members, building fund, documents, and quick access.",
};

/** Staff operations hub (formerly at `/command-center`). */
export default function OperationsPage() {
  return (
    <MinistryAppShell>
      <OperationsDashboard />
    </MinistryAppShell>
  );
}
