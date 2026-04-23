import type { Metadata } from "next";
import PublicVerification from "@/components/verify/PublicVerification";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Public verification — ${decodeURIComponent(slug)}`,
    description: "Sovereign Seal and stewardship summary for this ministry (read-only, donor-safe).",
  };
}

/** No MinistryAppShell — donor / public page with church white-label colors. */
export default async function PublicVerificationPage({ params }: P) {
  const { slug } = await params;
  return <PublicVerification slug={decodeURIComponent(slug)} />;
}
