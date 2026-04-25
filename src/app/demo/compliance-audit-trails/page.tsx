import type { Metadata } from "next";
import FeatureDemoShowcase from "@/components/demo/FeatureDemoShowcase";

export const metadata: Metadata = {
  title: "Compliance & audit trails | PARABLE Demo",
  description:
    "Demonstration of immutable trails, housing and payroll nudges, and filing rhythm — built for ecclesial accountability.",
};

export default function DemoComplianceAuditTrailsPage() {
  return (
    <FeatureDemoShowcase
      slug="/demo/compliance-audit-trails"
      heroKicker="Top features · Demo"
      heroTitle="Compliance & audit trails that hold up in the room"
      heroSubtitle="Whether it is a 990 workpaper request or a member asking “where did this gift go?” — PARABLE keeps the chain of custody visible without slowing Sunday down."
      bullets={[
        "Structured evidence for housing resolutions, restricted gifts, and high-risk disbursements.",
        "Automation nudges that respect ministry tax posture — not consumer fintech boilerplate.",
        "Trails that connect policy, documents, and journal lines for auditors and insurers.",
        "Designed for churches: clarity first, jargon never as the default lens.",
      ]}
      screenshotCaption="Compliance workspace — alerts, packets, and trail (placeholder)"
      videoCaption="Compliance storyboard — 941 rhythm + documentation (placeholder)"
    />
  );
}
