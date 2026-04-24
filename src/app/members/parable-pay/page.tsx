import type { Metadata } from "next";
import Link from "next/link";
import ParablePay from "@/components/members/ParablePay";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Parable Pay",
  description: "Givlify-mirror giving — PENDING to SECURED AR handshake.",
};

export default function ParablePayMembersPage() {
  return (
    <MinistryAppShell>
      <div className="mx-auto max-w-lg px-4 py-6">
        <header className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--brand-cyber)]/80">Members</p>
          <h1 className="parable-header text-xl">Parable Pay</h1>
          <p className="mt-1 text-sm text-white/45">Select a member in Member hub first, then return here. Primary accent is your tenant <span className="font-mono text-xs">primary_color</span> from the database.</p>
          <Link href="/member-hub" className="mt-2 inline-block text-xs font-bold uppercase tracking-widest text-[var(--brand-cyber)]/80 hover:underline">
            Open Member hub →
          </Link>
        </header>
        <ParablePay />
      </div>
    </MinistryAppShell>
  );
}
