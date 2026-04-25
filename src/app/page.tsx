import type { Metadata } from "next";
import MemberPortal from "@/member-app/MemberPortal";

export const metadata: Metadata = {
  title: "PARABLE Accounting — Member hub",
  description: "Giving, stewardship, fund tracking, and member profile — sovereign member experience.",
};

export default function HomePage() {
  return (
    <div className="min-h-dvh" style={{ background: "#050505" }}>
      <a
        href="/command-center"
        className="absolute left-3 top-3 z-20 text-[9px] font-bold uppercase tracking-widest text-white/35 hover:text-[#00FFFF]"
      >
        Staff — Command center
      </a>
      <MemberPortal />
    </div>
  );
}
