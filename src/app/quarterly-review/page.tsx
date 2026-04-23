import type { Metadata } from "next";
import MinistryAppShell from "@/components/MinistryAppShell";
import QuarterlyReview from "@/components/compliance/QuarterlyReview";

export const metadata: Metadata = {
  title: "EOQ 941 — Status room",
  description: "End-of-quarter Form 941 workpaper and liability view from the PARABLE ledger.",
};

export default function QuarterlyReviewPage() {
  return (
    <MinistryAppShell>
      <QuarterlyReview />
    </MinistryAppShell>
  );
}
