import type { Metadata } from "next";
import Link from "next/link";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Members",
  description: "Roster, stewardship, and Parable Pay for congregational giving.",
};

export default function MembersPage() {
  return (
    <MinistryAppShell>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-white">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--brand-cyber)]/80">Sovereign OS</p>
          <h1 className="parable-header text-2xl">Members</h1>
          <p className="mt-2 text-sm text-white/50">Givlify-mirror flow and full roster &mdash; one session across hub and giving.</p>
        </header>
        <ul className="space-y-3 text-sm">
          <li>
            <Link
              href="/member-portal"
              className="mb-2 block rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-4 font-semibold text-white/90 transition hover:border-cyan-400/40"
            >
              Member Sovereign App (Givlify mirror)
            </Link>
            <p className="mb-4 pl-1 text-xs text-zinc-500">Mobile-first: sanctuary, give flow, stewardship — /member-portal</p>
          </li>
          <li>
            <Link
              href="/member-hub"
              className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 font-semibold text-white/90 transition hover:border-[var(--brand-cyber)]/30"
            >
              Member intelligence &amp; roster
            </Link>
            <p className="mt-1 pl-1 text-xs text-zinc-500">Tap a row to set your active member session (Parable Pay uses it).</p>
          </li>
          <li>
            <Link
              href="/members/parable-pay"
              className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 font-semibold text-white/90 transition hover:border-[var(--brand-cyber)]/30"
            >
              Parable Pay (Givlify mirror)
            </Link>
            <p className="mt-1 pl-1 text-xs text-zinc-500">Matte cinematic UI, UCOA gate, PENDING {">"} AR sync {">"} SECURED receipt.</p>
          </li>
        </ul>
      </div>
    </MinistryAppShell>
  );
}
