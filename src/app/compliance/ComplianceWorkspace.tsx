"use client";

import { useBrand } from "@/components/branding/BrandProvider";
import AuditLedgerPreview from "@/components/compliance/AuditLedgerPreview";
import AuditVault, { type AuditVaultRow } from "@/components/compliance/AuditVault";
import SovereigntyDashboard from "@/components/compliance/SovereigntyDashboard";
import { useAuditMode } from "@/context/AuditModeContext";
import { buildWrittenAcknowledgmentHtml } from "@/lib/irsWrittenAcknowledgment";

const MOCK_MISSION = 184_200;
const MOCK_UBI = 12_400;

const MOCK_VAULT: AuditVaultRow[] = [
  {
    id: "1",
    source: "PARABLE_STREAM:livekit_tips",
    amountLabel: "$2,400.00",
    lane: "mission_exempt",
    verified: true,
  },
  {
    id: "2",
    source: "PARABLE_STREAM:youtube_ad_share",
    amountLabel: "$890.00",
    lane: "990-T_UBI",
    verified: false,
  },
  {
    id: "3",
    source: "PARABLE_STREAM:sponsor_block",
    amountLabel: "$3,200.00",
    lane: "990-T_UBI",
    verified: true,
  },
];

export default function ComplianceWorkspace() {
  const { auditMode } = useAuditMode();
  const { tenant } = useBrand();

  const sampleAck = buildWrittenAcknowledgmentHtml({
    organizationLegalName: tenant?.legal_name?.trim() || tenant?.display_name || "Example Community Church Inc.",
    ein: tenant?.tax_id_ein ?? "00-0000000",
    donorDisplayName: "Jordan Example",
    contributionDate: "2026-04-15",
    amountUsd: 500,
    goodsOrServicesProvided: false,
    taxYear: "2026",
  });

  if (auditMode) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-500">Compliance</p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">Institutional review</h1>
          <p className="max-w-2xl text-sm text-neutral-600">
            Gaming and streaming presentation layers are suppressed. Core financial fields and board artifacts only.
          </p>
        </header>
        <AuditLedgerPreview />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <p className="parable-sublabel">990 / 990-T prep</p>
        <h1 className="parable-header text-2xl md:text-3xl">Compliance cockpit</h1>
        <p className="max-w-2xl text-sm text-white/50">
          Router: <code className="text-[var(--brand-cyber)]">supabase/functions/stream-to-ledger/</code> · DDL:{" "}
          <code className="text-[var(--brand-cyber)]">supabase/migrations/</code>{" "}
          <span className="text-white/40">(same scripts under </span>
          <code className="text-xs text-white/70">db/</code>
          <span className="text-white/40">)</span> · Acknowledgment HTML:{" "}
          <code className="text-[var(--brand-cyber)]">src/lib/irsWrittenAcknowledgment.ts</code>
        </p>
      </header>

      <SovereigntyDashboard embedded exemptRevenue={MOCK_MISSION} ubiRevenue={MOCK_UBI} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AuditVault rows={MOCK_VAULT} />
        <section className="parable-live-surface rounded-2xl border border-white/10 p-6">
          <p className="parable-sublabel">Written acknowledgment</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Donor $250+ (HTML preview)</h2>
          <p className="mt-2 text-sm text-white/50">
            <span className="font-medium text-white/70">CWA engine (next):</span> batch from{" "}
            <code className="text-white/80">rpt_high_value_donor_candidates</code>, merge{" "}
            <code className="text-white/80">buildWrittenAcknowledgmentHtml</code>, then PDF via Playwright print or
            @react-pdf (not wired yet).
          </p>
          <details className="mt-4 rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-white/70">
            <summary className="cursor-pointer text-[#00f2ff]">Show sample HTML</summary>
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
              {sampleAck.slice(0, 1200)}
              {sampleAck.length > 1200 ? "…" : ""}
            </pre>
          </details>
        </section>
      </div>
    </div>
  );
}
