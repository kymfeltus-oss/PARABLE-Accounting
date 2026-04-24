"use client";

import { useEffect, useState } from "react";
import { MemberPortalProvider, useMemberPortalSession } from "./MemberPortalSessionContext";
import { Home } from "./modules/Home";
import { Give } from "./modules/Give";
import { Stewardship } from "./modules/Stewardship";
import { FundTrackers } from "./modules/FundTrackers";
import { Profile } from "./modules/Profile";
import { SOVEREIGN } from "./styles";

type Tab = "home" | "stewardship" | "funds" | "profile";

function MemberPortalInner() {
  const { loadDemoMember, sessionReady, demoMode, tenantId, brandReady } = useMemberPortalSession();
  const [tab, setTab] = useState<Tab>("home");
  const [give, setGive] = useState(false);

  useEffect(() => {
    if (sessionReady && demoMode && brandReady && tenantId) {
      void loadDemoMember();
    }
  }, [sessionReady, demoMode, loadDemoMember, tenantId, brandReady]);

  if (give) {
    return <Give onClose={() => setGive(false)} />;
  }

  return (
    <div className="min-h-dvh pb-16" style={{ background: SOVEREIGN.SHELL, color: "#fff" }}>
      {tab === "home" && <Home onGive={() => setGive(true)} />}
      {tab === "stewardship" && <Stewardship />}
      {tab === "funds" && <FundTrackers />}
      {tab === "profile" && <Profile />}

      <nav
        className="fixed bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-black/80 px-1 py-1 backdrop-blur-md"
        style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" }}
        aria-label="Member app"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between gap-0.5 text-[9px] font-bold uppercase tracking-wide">
          {(
            [
              { id: "home" as const, label: "Home" },
              { id: "stewardship" as const, label: "Stewardship" },
              { id: "funds" as const, label: "Funds" },
              { id: "profile" as const, label: "Profile" },
            ] as const
          ).map((n) => (
            <li key={n.id} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(n.id)}
                className="w-full rounded-lg py-2.5 transition"
                style={{
                  color: tab === n.id ? SOVEREIGN.GLOW : "rgba(255,255,255,0.4)",
                  background: tab === n.id ? "color-mix(in srgb, #00ffff 6%, transparent)" : "transparent",
                }}
              >
                {n.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/**
 * Member Sovereign App — Givlify-mirror giving + lightweight nav (CFO uses ERP; members see this shell).
 */
export default function MemberPortal() {
  return (
    <MemberPortalProvider>
      <MemberPortalInner />
    </MemberPortalProvider>
  );
}
