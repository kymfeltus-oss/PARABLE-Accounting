"use client";

import { BrandProvider } from "@/components/branding/BrandProvider";
import { AuditModeProvider } from "@/context/AuditModeContext";
import { DemoModeProvider } from "@/context/DemoModeContext";
import type { ReactNode } from "react";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrandProvider>
      <DemoModeProvider>
        <AuditModeProvider>{children}</AuditModeProvider>
      </DemoModeProvider>
    </BrandProvider>
  );
}
