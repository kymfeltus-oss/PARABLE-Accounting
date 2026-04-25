import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Onboarding | PARABLE",
  description: "Get your ministry set up on PARABLE.",
};

export default function ResourcesOnboardingPage() {
  return (
    <ProductWorkspacePlaceholder categoryLabel="Resources" title="Onboarding" slug="/resources/onboarding" />
  );
}
