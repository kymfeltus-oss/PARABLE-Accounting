import type { Metadata } from "next";
import DataSovereigntyHub from "@/components/data-sovereignty/DataSovereigntyHub";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Data sovereignty — import & export",
  description: "QuickBooks migration, legacy archive, Parable template, and audit export.",
};

export default function ImportExportPage() {
  return (
    <MinistryAppShell>
      <DataSovereigntyHub />
    </MinistryAppShell>
  );
}
