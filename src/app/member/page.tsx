"use client";
import IntroFlashClient from "../intro/IntroFlashClient";

export default function MemberGatewayPage() {
  return (
    <IntroFlashClient 
      appType="giving"
      subtitle="" // PURGED: No blurb on the member side
      firstInputPlaceholder="EMAIL"
      secondInputPlaceholder="PASSWORD"
    />
  );
}