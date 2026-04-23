import type { Metadata } from "next";
import MemberHub from "@/components/ministry/MemberHub";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Member hub",
  description: "Growth, retention, and per-member giving sustainability signals.",
};

export default function MemberHubPage() {
  return (
    <MinistryAppShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div>
          <h1 className="parable-header text-2xl">Member intelligence</h1>
          <p className="mt-1 text-sm text-zinc-500">Roster, YoY join pulse, and stewardship averages from linked donations.</p>
        </div>
        <MemberHub />
      </div>
    </MinistryAppShell>
  );
}
