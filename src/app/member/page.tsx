"use client";
import IntroFlashClient from "../intro/IntroFlashClient";

export default function MemberGatewayPage() {
  return (
    <IntroFlashClient 
      appType="giving"
      subtitle="Sovereign Giving Portal" 
      primaryLabel="Contribute" 
      primaryHref="/give"
      secondaryLabel="My Legacy"
      secondaryHref="/portal/history"
    />
  );
}