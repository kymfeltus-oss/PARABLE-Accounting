"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AuditModeContextValue = {
  auditMode: boolean;
  setAuditMode: (value: boolean) => void;
  toggleAuditMode: () => void;
};

const AuditModeContext = createContext<AuditModeContextValue | null>(null);

export function AuditModeProvider({ children }: { children: ReactNode }) {
  const [auditMode, setAuditMode] = useState(false);
  const toggleAuditMode = useCallback(() => setAuditMode((v) => !v), []);

  useEffect(() => {
    document.documentElement.classList.toggle("audit-mode", auditMode);
    document.documentElement.style.colorScheme = auditMode ? "light" : "dark";
    return () => {
      document.documentElement.classList.remove("audit-mode");
      document.documentElement.style.colorScheme = "dark";
    };
  }, [auditMode]);

  const value = useMemo(
    () => ({
      auditMode,
      setAuditMode,
      toggleAuditMode,
    }),
    [auditMode, toggleAuditMode],
  );

  return <AuditModeContext.Provider value={value}>{children}</AuditModeContext.Provider>;
}

export function useAuditMode(): AuditModeContextValue {
  const ctx = useContext(AuditModeContext);
  if (!ctx) {
    throw new Error("useAuditMode must be used within AuditModeProvider");
  }
  return ctx;
}
