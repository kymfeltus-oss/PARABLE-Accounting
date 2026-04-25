import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Staff onboarding | PARABLE",
  description: "Staff and role onboarding for PARABLE.",
};

export default function ResourcesStaffOnboardingPage() {
  return (
    <ProductWorkspacePlaceholder
      categoryLabel="Resources"
      title="Staff onboarding"
      slug="/resources/staff-onboarding"
    />
  );
}
