import type { Metadata } from "next";
import FeatureDemoShowcase from "@/components/demo/FeatureDemoShowcase";

export const metadata: Metadata = {
  title: "Connected intelligence | PARABLE Demo",
  description:
    "See how PARABLE connects ledger, giving, compliance, and narrative context so finance teams act with confidence.",
};

export default function DemoConnectedIntelligencePage() {
  return (
    <FeatureDemoShowcase
      slug="/demo/connected-intelligence"
      heroKicker="Top features · Demo"
      heroTitle="Connected intelligence across your ministry stack"
      heroSubtitle="One control plane ties transactions, people, funds, and policy context together — so approvals, closes, and board-ready answers stay fast and defensible."
      bullets={[
        "Unify GL, restricted funds, and operational signals without tab sprawl — built for how churches actually work.",
        "Surface anomalies and stewardship context before they become board surprises or audit findings.",
        "Reduce manual reconciliation with AI-assisted matching that respects your chart and your governance.",
        "Designed for collaboration: finance, pastors, and treasurers share a single source of truth.",
      ]}
      screenshotCaption="High-resolution UI capture — ledger + intelligence rail (placeholder)"
      videoCaption="Product walkthrough — 90 seconds (embedded player placeholder)"
    />
  );
}
