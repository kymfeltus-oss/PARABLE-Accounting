"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "parable-simulation";

export type DemoModeContextValue = {
  /** True = SIMULATION (not production intent). */
  isSimulation: boolean;
  setIsSimulation: (v: boolean) => void;
  toggleSimulation: () => void;
  /** True after `useEffect` reads localStorage (avoids flash). */
  simulationReady: boolean;
};

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isSimulation, setIsSimulation] = useState(false);
  const [simulationReady, setSimulationReady] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1") {
        setIsSimulation(true);
      }
    } catch {
      // ignore
    } finally {
      setSimulationReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-simulation", isSimulation ? "true" : "false");
  }, [isSimulation]);

  useEffect(() => {
    if (!simulationReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, isSimulation ? "1" : "0");
    } catch {
      // ignore
    }
  }, [isSimulation, simulationReady]);

  const toggleSimulation = useCallback(() => setIsSimulation((v) => !v), []);

  const value = useMemo<DemoModeContextValue>(
    () => ({
      isSimulation,
      setIsSimulation,
      toggleSimulation,
      simulationReady,
    }),
    [isSimulation, simulationReady, toggleSimulation],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) {
    throw new Error("useDemoMode must be used within DemoModeProvider");
  }
  return ctx;
}

/**
 * For optional consumers (e.g. leaf components) when provider is guaranteed by layout.
 * Returns null if missing provider instead of throwing.
 */
export function useOptionalDemoMode(): DemoModeContextValue | null {
  return useContext(DemoModeContext);
}
