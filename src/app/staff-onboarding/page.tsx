import type { Metadata } from "next";
import StaffOnboarding from "@/components/staff/StaffOnboarding";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Staff Genesis — org onboarding | PARABLE",
  description: "Sovereignty gates, ministerial housing shield, contractor classification.",
};

export default function StaffOnboardingPage() {
  return (
    <MinistryAppShell>
      <StaffOnboarding />
    </MinistryAppShell>
  );
}
