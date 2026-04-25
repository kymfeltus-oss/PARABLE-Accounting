import type { Metadata } from "next";
import FeatureDemoShowcase from "@/components/demo/FeatureDemoShowcase";

export const metadata: Metadata = {
  title: "Data portability | PARABLE Demo",
  description:
    "Import from legacy systems and export audit-ready bundles — sovereignty over your ministry data.",
};

export default function DemoDataPortabilityPage() {
  return (
    <FeatureDemoShowcase
      slug="/demo/data-portability"
      heroKicker="Top features · Demo"
      heroTitle="Import / export built for migrations and accountability"
      heroSubtitle="Bring QuickBooks history, spreadsheets, and donor systems forward — then export defensible packages when counsel, auditors, or successors need the whole picture."
      bullets={[
        "Guided imports with ministry chart mapping — fewer orphan accounts after go-live.",
        "Certified export patterns for board packets, migrations, and long-term archive.",
        "Separation of duties friendly: who imported, who approved, who locked the period.",
        "Keeps velocity high without trading away the documentation trail.",
      ]}
      screenshotCaption="Import wizard + validation preview (placeholder)"
      videoCaption="End-to-end migration clip — import to first close (placeholder)"
    />
  );
}
