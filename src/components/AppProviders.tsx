"use client";

import { BrandProvider } from "@/components/branding/BrandProvider";
import { ActiveMemberProvider } from "@/context/ActiveMemberContext";
import { AuditModeProvider } from "@/context/AuditModeContext";
import { DemoModeProvider } from "@/context/DemoModeContext";
import type { ReactNode } from "react";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrandProvider>
      <ActiveMemberProvider>
        <DemoModeProvider>
          <AuditModeProvider>{children}</AuditModeProvider>
        </DemoModeProvider>
      </ActiveMemberProvider>
    </BrandProvider>
  );
}
