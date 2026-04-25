"use client";
import IntroFlashClient from "../intro/IntroFlashClient";

export default function StaffHubPage() {
  return (
    <IntroFlashClient 
      appType="accounting"
      subtitle="Institutional Command" 
      primaryLabel="Open Ledger" 
      primaryHref="/dashboard/accounts"
      secondaryLabel="System Audit"
      secondaryHref="/dashboard/audit"
    />
  );
}