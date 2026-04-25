import type { Metadata } from "next";
import MemberPortal from "@/member-app/MemberPortal";

export const metadata: Metadata = {
  title: "Member hub — Parable",
  description: "Sovereign member app: sanctuary, giving, stewardship, fund tracking.",
};

export default function MemberPortalPage() {
  return (
    <div className="min-h-dvh" style={{ background: "#050505" }}>
      <a
        href="/command-center"
        className="absolute left-3 top-3 z-20 text-[9px] font-bold uppercase tracking-widest text-white/35 hover:text-[#00FFFF]"
      >
        ← Command center
      </a>
      <MemberPortal />
    </div>
  );
}
