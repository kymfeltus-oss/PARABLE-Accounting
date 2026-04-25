"use client";

import Link from "next/link";
import { useBrand } from "@/components/branding/BrandProvider";
import FoundryNavIcon from "@/components/FoundryNavIcon";
import { useAuditMode } from "@/context/AuditModeContext";
import { sidebarNavigation, sidebarAuditModule, type FoundryModule } from "@/lib/sidebarFoundryNav";
import DashboardWidgetMatrix from "./DashboardWidgetMatrix";

function moduleTopIcon(icon: string): Parameters<typeof FoundryNavIcon>[0]["name"] {
  switch (icon) {
    case "CalculatorIcon":
      return "calculator";
    case "ChartBarIcon":
      return "chartbar";
    case "UsersIcon":
      return "users";
    case "OfficeBuildingIcon":
      return "building";
    case "FolderIcon":
      return "folder";
    case "GiftIcon":
      return "gift";
    default:
      return "calculator";
  }
}

const QUICK: { href: string; label: string; sub: string }[] = [
  { href: "/member-portal", label: "Member portal", sub: "Home, give, funds, profile (member app)" },
  { href: "/giving", label: "Parable Giving", sub: "Tithes, offerings, Parable Pay" },
  { href: "/member-hub", label: "Member hub", sub: "Contributors & giving" },
  { href: "/erp-hub", label: "Financial hub (legacy)", sub: "AP / AR in one view" },
  { href: "/sovereign-close", label: "Sovereign close", sub: "Month-end (alias of AI Close)" },
  { href: "/compliance", label: "Compliance", sub: "990, UBI, board prep" },
  { href: "/sovereign-vault", label: "Sovereign vault", sub: "W-9, letters, files" },
  { href: "/staff-onboarding", label: "Staff Genesis", sub: "Onboarding & roles" },
  { href: "/import-export", label: "Data sovereignty", sub: "Import / export" },
  { href: "/chart-of-accounts", label: "Chart of accounts", sub: "UCOA" },
];

/**
 * Main command center — module entry points, quick links, and room to grow.
 */
export default function OperationsDashboard() {
  const { tenant } = useBrand();
  const { auditMode } = useAuditMode();
  const modules: FoundryModule[] = auditMode ? sidebarAuditModule : sidebarNavigation;
  const org = tenant?.display_name ?? "Your ministry";

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-8">
      <header className="text-center md:text-left">
        <p
          className={["text-[10px] font-bold uppercase tracking-[0.35em]", auditMode ? "text-neutral-500" : ""].join(" ")}
          style={auditMode ? undefined : { color: "rgb(var(--brand-cyber-rgb) / 0.88)" }}
        >
          Command center
        </p>
        <h1
          className={["mt-2 text-2xl sm:text-3xl md:text-4xl", auditMode ? "font-black uppercase italic tracking-tighter text-neutral-900" : "parable-header"].join(" ")}
        >
          {org}
        </h1>
        <p
          className={[
            "mt-3 max-w-2xl text-sm leading-relaxed md:mx-0",
            auditMode ? "text-neutral-600" : "text-white/50",
          ].join(" ")}
        >
          {auditMode
            ? "Institutional view — jump to reporting, records, and filings without operational noise in the rail."
            : "One place to run fund accounting, people, building capital, and governed documents. Use the left rail for modules, or open a tile below."}
        </p>
      </header>

      <section>
        <h2
          className={["mb-4 text-[10px] font-bold uppercase tracking-[0.25em]", auditMode ? "text-neutral-500" : "text-white/40"].join(" ")}
        >
          Primary modules
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            if (!mod.path) return null;
            const sub =
              mod.name === "Accounting"
                ? "AP, AR, GL, tax, UCOA, controls, AI close, expenses"
                : mod.name === "Reporting"
                  ? "Board packs, cadence, exports"
                  : mod.name === "Members"
                    ? "Contributor hub & relationships"
                    : mod.name === "Member portal"
                      ? "Member app: home, give, funds, profile"
                    : mod.name === "Project Building Fund"
                      ? "Restricted capital campaigns"
                      : mod.name === "Documents"
                        ? "Sovereign vault — W-9, 501(c)(3), receipts"
                      : mod.name === "Parable Giving"
                        ? "Tithes, offerings, Parable Pay & UCOA routing"
                        : "";
            const card = auditMode
              ? "flex h-full min-h-[7.5rem] flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow"
              : "flex h-full min-h-[7.5rem] flex-col rounded-2xl border border-white/10 bg-black/35 p-5 transition hover:border-[rgb(var(--brand-cyber-rgb)/0.32)] hover:shadow-[0_0_36px_rgb(var(--brand-cyber-rgb)/0.08)]";
            const titleC = auditMode ? "text-sm font-bold tracking-tight text-neutral-900" : "text-sm font-bold tracking-tight text-white/95";
            const subC = auditMode ? "mt-auto text-xs leading-relaxed text-neutral-600" : "mt-auto text-xs leading-relaxed text-white/45";
            const iconWrap = auditMode
              ? "rounded-lg border border-neutral-200 bg-white p-2"
              : "rounded-lg border border-white/10 bg-white/[0.04] p-2";
            return (
              <li key={mod.name}>
                <Link href={mod.path} className={card}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className={iconWrap}>
                      <FoundryNavIcon name={moduleTopIcon(mod.icon)} size={22} />
                    </span>
                    <span className={titleC}>{mod.name}</span>
                  </div>
                  <p className={subC}>{sub}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <DashboardWidgetMatrix />

      {!auditMode && (
        <section>
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">Quick access</h2>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {QUICK.map((q) => (
              <li key={q.href}>
                <Link
                  href={q.href}
                  className="block rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 transition hover:border-[rgb(var(--brand-cyber-rgb)/0.2)] hover:bg-white/[0.04]"
                >
                  <p className="text-xs font-semibold text-white/90">{q.label}</p>
                  <p className="mt-0.5 text-[10px] text-white/40">{q.sub}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {auditMode && (
        <section>
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">Records & filings</h2>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {[
              { href: "/compliance", label: "990 / UBI" },
              { href: "/quarterly-review", label: "EOQ 941" },
              { href: "/cfo-summary", label: "CFO compliance" },
              { href: "/contractor-dashboard", label: "1099 contractors" },
            ].map((q) => (
              <li key={q.href}>
                <Link
                  href={q.href}
                  className="block rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
                >
                  {q.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!auditMode && (
        <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-widest text-white/35 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="text-white/50 group-open:text-[var(--brand-cyber)]">For developers</span> — database & migrations
          </summary>
          <div className="mt-4 text-sm leading-relaxed text-white/50">
            <p>
              Supabase: <code className="text-[var(--brand-cyber)]">npx supabase link --project-ref YOUR_REF</code> then{" "}
              <code className="text-[var(--brand-cyber)]">npm run db:push</code>. Migrations live in{" "}
              <code className="text-xs text-white/70">supabase/migrations/</code>. Expose schema{" "}
              <code className="text-xs text-white/70">parable_ledger</code> on the host project (Settings → API) if needed.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
