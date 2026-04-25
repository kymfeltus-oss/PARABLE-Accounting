import type { Metadata } from "next";
import FeatureDemoShowcase from "@/components/demo/FeatureDemoShowcase";

export const metadata: Metadata = {
  title: "Reporting & dashboards | PARABLE Demo",
  description:
    "Ministry-grade dashboards: tithe trends, fund health, compliance cadence, and executive summaries without exporting to spreadsheets.",
};

export default function DemoReportingDashboardsPage() {
  return (
    <FeatureDemoShowcase
      slug="/demo/reporting-dashboards"
      heroKicker="Top features · Demo"
      heroTitle="Reporting & dashboards your elders will actually read"
      heroSubtitle="From weekly operations to quarterly governance — role-aware dashboards translate ledger truth into ministry language, with drill-down when the CPA asks for receipts."
      bullets={[
        "Executive views for pastors and boards; operational depth for controllers and bookkeepers.",
        "Fund and program visibility that respects donor intent and restricted balances.",
        "Trend and variance callouts tuned for ministry cadence — not generic SMB widgets.",
        "Export when you must; stay inside PARABLE when you want speed and audit trails.",
      ]}
      screenshotCaption="Dashboard gallery — funds, giving, close status (placeholder)"
      videoCaption="Narrated tour — reporting & drill paths (placeholder)"
    />
  );
}
