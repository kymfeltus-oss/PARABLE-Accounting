import type { Metadata } from "next";
import OperationsDashboard from "@/components/dashboard/OperationsDashboard";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Command center",
  description: "Ministry operations: accounting, reporting, members, building fund, documents, and quick access.",
};

export default function Home() {
  return (
    <MinistryAppShell>
      <OperationsDashboard />
    </MinistryAppShell>
  );
}
