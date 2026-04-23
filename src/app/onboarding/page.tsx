import type { Metadata } from "next";
import InstantOnboarding from "@/components/onboarding/InstantOnboarding";

export const metadata: Metadata = {
  title: "Instant activation — PARABLE Ministry ERP",
  description: "Sovereign OS one-minute onboarding: brand, fund genesis, and stream go-live.",
};

export default function OnboardingPage() {
  return <InstantOnboarding />;
}
