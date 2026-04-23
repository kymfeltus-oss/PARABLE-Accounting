import type { Metadata } from "next";
import ProjectTracker from "@/components/ministry/ProjectTracker";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Building projects (CapEx)",
  description: "Building fund project tracker, restricted-fund cover checks, and AP / invoice trail.",
};

export default function BuildingProjectsPage() {
  return (
    <MinistryAppShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          <h1 className="parable-header text-2xl">Project tracker</h1>
          <p className="mt-1 text-sm text-zinc-500">Capital use vs restricted building fund; link maintenance invoices to milestones via AP.</p>
        </div>
        <ProjectTracker />
      </div>
    </MinistryAppShell>
  );
}
