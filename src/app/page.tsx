import Link from "next/link";
import MinistryAppShell from "@/components/MinistryAppShell";

const PLACEHOLDER_TILES = [
  {
    title: "General ledger",
    body: "Double-entry journals, periods close, and audit trail — wired to your chart of accounts.",
  },
  {
    title: "Designated giving",
    body: "Track restricted and unrestricted funds; tie deposits to batches and donor statements.",
  },
  {
    title: "Approvals & roles",
    body: "Treasurer, finance team, and pastors see only what they need — before money moves.",
  },
] as const;

export default function Home() {
  return (
    <MinistryAppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="md:hidden">
          <h1 className="parable-header text-xl">Operations</h1>
          <p className="mt-1 text-sm text-white/50">Fund accounting, giving, and ministry spend in one place.</p>
        </div>

        <section className="parable-live-surface rounded-2xl border border-white/10 p-6 md:p-8">
          <p className="parable-sublabel">Next build-out</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Church-ready accounting core</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
            Supabase: run{" "}
            <code className="text-[var(--brand-cyber)]">npx supabase link --project-ref YOUR_REF</code> then{" "}
            <code className="text-[var(--brand-cyber)]">npm run db:push</code> (migrations in{" "}
            <code className="text-xs text-white/80">supabase/migrations/</code>). Same SQL is mirrored under{" "}
            <code className="text-xs text-white/80">db/</code> for the SQL Editor. Expose schema{" "}
            <code className="text-xs text-white/80">parable_ledger</code> on the host project (Settings → API) if it is
            not listed. Wire RLS by ministry when you add org columns.
          </p>
          <p className="mt-4 text-sm">
            <Link
              href="/compliance"
              className="font-semibold text-[var(--brand-cyber)] underline-offset-4 transition hover:opacity-90 hover:underline"
            >
              Open compliance cockpit →
            </Link>{" "}
            <span className="text-white/35">·</span>{" "}
            <Link
              href="/sovereign-accord"
              className="font-semibold text-[var(--brand-cyber)] underline-offset-4 transition hover:opacity-90 hover:underline"
            >
              Sovereign Accord →
            </Link>
          </p>
        </section>

        <ul className="grid gap-4 md:grid-cols-3">
          {PLACEHOLDER_TILES.map((tile) => (
            <li key={tile.title}>
              <article className="parable-live-surface flex h-full flex-col rounded-xl border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-[var(--brand-cyber)]">{tile.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-white/55">{tile.body}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </MinistryAppShell>
  );
}
