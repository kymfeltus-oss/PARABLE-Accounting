"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "parable_active_member_v1";

export type ActiveMember = {
  id: string;
  full_name: string;
};

type Ctx = {
  activeMember: ActiveMember | null;
  setActiveMember: (m: ActiveMember | null) => void;
};

const ActiveMemberContext = createContext<Ctx | null>(null);

function readStored(): ActiveMember | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ActiveMember;
    if (p && typeof p.id === "string" && typeof p.full_name === "string") return p;
  } catch {
    /* ignore */
  }
  return null;
}

export function ActiveMemberProvider({ children }: { children: ReactNode }) {
  const [activeMember, setActiveState] = useState<ActiveMember | null>(null);

  useEffect(() => {
    setActiveState(readStored());
  }, []);

  const setActiveMember = useCallback((m: ActiveMember | null) => {
    setActiveState(m);
    if (typeof window === "undefined") return;
    if (m) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m));
      } catch {
        /* ignore */
      }
    } else {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("parable-active-member"));
    }
  }, []);

  const value = useMemo(
    () => ({
      activeMember,
      setActiveMember,
    }),
    [activeMember, setActiveMember]
  );

  return <ActiveMemberContext.Provider value={value}>{children}</ActiveMemberContext.Provider>;
}

export function useActiveMember(): Ctx {
  const c = useContext(ActiveMemberContext);
  if (!c) {
    throw new Error("useActiveMember must be used within ActiveMemberProvider");
  }
  return c;
}
