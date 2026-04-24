"use client";

import { useCallback, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FOUNDRY_SUBMISSION_KEY,
  isGateChecklistComplete,
  taskListForGate,
  toReportingPeriod,
  type CloseTaskDef,
} from "@/lib/close/closeChecklistConfig";
import type { Dispatch, SetStateAction } from "react";
import { saveCloseChecklistItem, type CloseChecklistRow, type StaffRow } from "@/lib/close/closeChecklistData";
import { TENANT_GLOW_FALLBACK } from "@/lib/brandCss";

/**
 * Styling: `SovereignCloseWizard` / `load()` calls `applyTenantCssVars` → --tenant-glow (primary), --brand-surface (accent).
 * Glows use primary; checkboxes ring with accent mixed toward primary for contrast on matte surfaces.
 */
function formatLedgerTimestamp(iso: string): string {
  const t = new Date(iso);
  return t
    .toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

const GATE_INFO: { gate: 1 | 2 | 3 | 4; title: string; sub: string }[] = [
  { gate: 1, title: "Gate 1: Entry completion", sub: "Tithes & offerings" },
  { gate: 2, title: "Gate 2: Institutional reconciliation", sub: "Bank, restricted, AP, AR" },
  { gate: 3, title: "Gate 3: AI governance & locking", sub: "Internal controls & adjustments" },
  { gate: 4, title: "Gate 4: Distribution & sign-off", sub: "Statements, analysis, executive review" },
];

type Props = {
  monthStart: string;
  tenantId: string;
  supabase: SupabaseClient;
  staff: StaffRow[];
  rows: Map<string, CloseChecklistRow>;
  onSaved: () => void;
  periodLabel: string;
  readOnly: boolean;
  onFoundrySubmit: (p: { verifierStaffId: string; verifierName: string }) => Promise<{ error: string | null }>;
  foundrySubmitting: boolean;
};

function TaskBlock({
  def,
  gateNumber,
  periodLabel,
  rows,
  staff,
  supabase,
  tenantId,
  reportingPeriod,
  onSaved,
  readOnly,
  setErr,
  saving,
  setSaving,
  localPick,
  setLocalPick,
}: {
  def: CloseTaskDef;
  gateNumber: 1 | 2 | 3 | 4;
  periodLabel: string;
  rows: Map<string, CloseChecklistRow>;
  staff: StaffRow[];
  supabase: SupabaseClient;
  tenantId: string;
  reportingPeriod: string;
  onSaved: () => void;
  readOnly: boolean;
  setErr: (s: string | null) => void;
  saving: string | null;
  setSaving: (k: string | null) => void;
  localPick: Record<string, string>;
  setLocalPick: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const markTask = useCallback(
    async (d: CloseTaskDef, checked: boolean) => {
      setErr(null);
      if (!checked) return;
      const pick = localPick[d.key] || "";
      if (!pick) {
        setErr("Select a staff member before attesting.");
        return;
      }
      const staffRow = staff.find((s) => s.id === pick);
      const name = staffRow?.staff_name?.trim() || "Staff";
      setSaving(d.key);
      try {
        const r = await saveCloseChecklistItem(supabase, {
          tenantId,
          reportingPeriod,
          gateNumber,
          taskName: d.key,
          verifierName: name,
          verifierStaffId: pick,
        });
        if (r.error) setErr(r.error);
        else onSaved();
      } finally {
        setSaving(null);
      }
    },
    [gateNumber, localPick, onSaved, reportingPeriod, setErr, setSaving, staff, supabase, tenantId]
  );

  const ext = rows.get(def.key);
  const done = Boolean(ext?.verifier_name && ext?.completed_at);
  const staffIdForRow =
    ext?.verifier_staff_id && staff.some((s) => s.id === ext.verifier_staff_id)
      ? ext.verifier_staff_id
      : ext?.verifier_name
        ? (staff.find((s) => s.staff_name === ext.verifier_name)?.id ?? "")
        : "";
  const labelText =
    def.key === "g1_tithes_offerings" ? `All tithes and offerings posted for ${periodLabel}` : def.isSubItem ? `· ${def.label}` : def.label;

  const primary = "var(--tenant-glow, " + TENANT_GLOW_FALLBACK + ")";
  const accent = "var(--brand-surface, #18181b)";

  return (
    <div
      className={[
        "flex flex-col gap-3 border-b border-zinc-800/50 py-3.5 sm:flex-row sm:items-center sm:gap-4",
        def.isSubItem ? "pl-0 sm:pl-4" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="sr-only">Attest</span>
        <label
          className="relative mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded"
          style={{
            boxShadow: done ? `0 0 16px color-mix(in srgb, ${primary} 22%, transparent)` : undefined,
          }}
        >
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer appearance-none rounded border-2 border-zinc-600 transition"
            style={{
              background: done
                ? `color-mix(in srgb, ${accent} 18%, #09090b)`
                : "color-mix(in srgb, #0a0a0a, transparent 25%)",
              borderColor: done
                ? `color-mix(in srgb, ${accent} 55%, ${primary} 45%)`
                : "color-mix(in srgb, #52525b 80%, " + primary + " 20%)",
              boxShadow: done
                ? `inset 0 0 0 2px color-mix(in srgb, ${accent} 50%, ${primary} 50%), 0 0 12px color-mix(in srgb, ${primary} 28%, transparent)`
                : `0 0 0 1px color-mix(in srgb, ${primary} 8%, transparent)`,
            }}
            checked={done}
            disabled={readOnly || done || saving === def.key}
            onChange={(e) => {
              void markTask(def, e.target.checked);
            }}
            aria-label={labelText}
          />
        </label>
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug tracking-tight text-zinc-200">{labelText}</p>
      </div>
      <div className="flex w-full min-w-0 flex-col justify-end gap-1 pl-0 sm:max-w-[10.5rem] sm:pl-0 sm:shrink-0">
        <span
          className="text-[7px] font-bold uppercase tracking-widest"
          style={{ color: `color-mix(in srgb, ${primary} 45%, #71717a)` }}
        >
          Staff
        </span>
        <select
          className="w-full rounded-md border border-zinc-800/90 bg-black/50 px-2 py-1.5 text-xs text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ boxShadow: `0 0 0 1px color-mix(in srgb, ${primary} 10%, transparent), 0 2px 12px rgba(0,0,0,0.35)` }}
          value={localPick[def.key] ?? (done ? staffIdForRow : "")}
          disabled={readOnly || done}
          onChange={(e) => setLocalPick((m) => ({ ...m, [def.key]: e.target.value }))}
          aria-label={`Staff for ${def.key}`}
        >
          <option value="">Select staff</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.staff_name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex w-full min-w-0 flex-col sm:w-[7.5rem] sm:shrink-0 sm:text-right">
        <span
          className="text-[7px] font-bold uppercase tracking-widest sm:text-right"
          style={{ color: `color-mix(in srgb, ${primary} 40%, #71717a)` }}
        >
          Attested
        </span>
        <p
          className="whitespace-nowrap font-mono text-[9px] font-medium leading-tight tracking-tight text-zinc-200 tabular-nums sm:pt-1.5"
          style={{
            textShadow: done ? `0 0 8px color-mix(in srgb, ${primary} 30%, transparent)` : undefined,
            fontFeatureSettings: '"tnum", "lnum"',
          }}
        >
          {done && ext?.completed_at ? formatLedgerTimestamp(ext.completed_at) : "—"}
        </p>
      </div>
    </div>
  );
}

export default function CloseLedgerAccordion({
  monthStart,
  tenantId,
  supabase,
  staff,
  rows,
  onSaved,
  periodLabel,
  readOnly,
  onFoundrySubmit,
  foundrySubmitting,
}: Props) {
  const reportingPeriod = useMemo(() => toReportingPeriod(monthStart), [monthStart]);
  const [localPick, setLocalPick] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [leadPick, setLeadPick] = useState("");

  const g4ChecklistComplete = useMemo(() => isGateChecklistComplete(4, rows), [rows]);

  const foundryRow = rows.get(FOUNDRY_SUBMISSION_KEY);
  const foundryDone = Boolean(foundryRow?.verifier_name && foundryRow?.completed_at);

  const primary = "var(--tenant-glow, " + TENANT_GLOW_FALLBACK + ")";

  return (
    <div className="mt-2 space-y-5 p-1 sm:p-0">
      <div
        className="mb-1 rounded-2xl border border-zinc-800/80 p-4 sm:p-5"
        style={{
          background: "linear-gradient(165deg, #030303 0%, #0c0c0c 40%, #050505 100%)",
          boxShadow: `0 0 0 1px color-mix(in srgb, ${primary} 7%, #27272a), 0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 color-mix(in srgb, ${primary} 9%, transparent)`,
        }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-[0.4em]"
          style={{ color: `color-mix(in srgb, ${primary} 88%, #f4f4f5)` }}
        >
          Interactive audit checklist
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Four gate cards — attest each line with a directory identity; the ledger records server time on save.
        </p>
        {err && <p className="mt-2 text-xs text-amber-200/90">{err}</p>}
        {readOnly && (
          <p
            className="mt-2 rounded-lg border px-2.5 py-2 text-xs font-medium"
            style={{
              borderColor: `color-mix(in srgb, ${primary} 32%, transparent)`,
              background: `color-mix(in srgb, ${primary} 5%, #09090b)`,
              color: `color-mix(in srgb, ${primary} 92%, #fff)`,
            }}
            role="status"
          >
            Read only: executive review submitted for {periodLabel} — checklist attestation is locked.
          </p>
        )}
      </div>

      {GATE_INFO.map(({ gate, title, sub }) => {
        const taskDefs: CloseTaskDef[] = taskListForGate(gate);
        const attested = taskDefs.filter((d) => {
          const r = rows.get(d.key);
          return r?.verifier_name && r?.completed_at;
        }).length;

        return (
          <div
            key={gate}
            className="overflow-hidden rounded-2xl border border-zinc-800/70"
            style={{
              background: "linear-gradient(180deg, #060606 0%, #0a0a0a 55%, #050505 100%)",
              boxShadow: `0 0 0 1px color-mix(in srgb, ${primary} 8%, #27272a), 0 18px 50px rgba(0,0,0,0.5), inset 0 1px 0 color-mix(in srgb, ${primary} 7%, transparent)`,
            }}
          >
            <div
              className="border-b border-zinc-800/60 px-4 py-3.5 sm:px-5"
              style={{
                background: `linear-gradient(98deg, color-mix(in srgb, var(--brand-surface, #0a0a0a) 35%, #000) 0%, #080808 100%)`,
                boxShadow: `inset 0 -1px 0 color-mix(in srgb, ${primary} 10%, transparent)`,
              }}
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-[0.12em]"
                    style={{ color: `color-mix(in srgb, ${primary} 92%, #fff)` }}
                  >
                    {title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">{sub}</p>
                </div>
                <span
                  className="font-mono text-[9px] tabular-nums text-zinc-500"
                  style={{ textShadow: `0 0 10px color-mix(in srgb, ${primary} 15%, transparent)` }}
                >
                  {attested}/{taskDefs.length} attested
                </span>
              </div>
            </div>

            <div className="space-y-0 px-2 py-1 sm:px-4 sm:py-2">
              {taskDefs.map((def) => (
                <TaskBlock
                  key={def.key}
                  def={def}
                  gateNumber={gate}
                  periodLabel={periodLabel}
                  rows={rows}
                  staff={staff}
                  supabase={supabase}
                  tenantId={tenantId}
                  reportingPeriod={reportingPeriod}
                  onSaved={onSaved}
                  readOnly={readOnly}
                  setErr={setErr}
                  saving={saving}
                  setSaving={setSaving}
                  localPick={localPick}
                  setLocalPick={setLocalPick}
                />
              ))}

              {gate === 4 && (
                <div
                  className="mt-2 space-y-3 border-t border-zinc-800/60 pt-4 sm:mt-4"
                  style={{ boxShadow: `inset 0 1px 0 0 color-mix(in srgb, ${primary} 5%, transparent)` }}
                >
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.28em] text-zinc-500"
                    style={{ textShadow: `0 0 8px color-mix(in srgb, ${primary} 12%, transparent)` }}
                  >
                    Submission engine
                  </p>
                  <p className="text-sm text-zinc-400">
                    Routes a secure Foundry alert to your pastor or lead administrator. Persists status{" "}
                    <span className="font-mono" style={{ color: `color-mix(in srgb, ${primary} 75%, #a1a1aa)` }}>
                      PENDING_EXECUTIVE_SIGN
                    </span>{" "}
                    on the sovereign close ledger.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Primary recipient</span>
                      <select
                        className="mt-1.5 w-full max-w-sm rounded-md border border-zinc-800 bg-black/55 px-2.5 py-2 text-xs text-zinc-200"
                        value={leadPick}
                        onChange={(e) => setLeadPick(e.target.value)}
                        disabled={readOnly || foundryDone}
                        style={{ boxShadow: `0 0 0 1px color-mix(in srgb, ${primary} 12%, transparent)` }}
                      >
                        <option value="">Select approver</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.staff_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!leadPick) {
                          setErr("Choose a recipient for executive review.");
                          return;
                        }
                        const srow = staff.find((x) => x.id === leadPick);
                        const v = srow?.staff_name?.trim() || "Lead";
                        const r = await onFoundrySubmit({ verifierStaffId: leadPick, verifierName: v });
                        if (r.error) {
                          setErr(r.error);
                          return;
                        }
                        setErr(null);
                      }}
                      disabled={readOnly || foundryDone || !g4ChecklistComplete || !leadPick || foundrySubmitting}
                      className="w-full rounded-2xl px-5 py-3.5 text-xs font-bold uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                      style={{
                        color: "#0a0a0a",
                        background: `linear-gradient(180deg, color-mix(in srgb, ${primary} 75%, #fff) 0%, color-mix(in srgb, ${primary} 88%, #e4e4e7) 100%)`,
                        boxShadow: `0 0 32px color-mix(in srgb, ${primary} 38%, transparent), 0 0 0 1px color-mix(in srgb, ${primary} 55%, #000), inset 0 1px 0 color-mix(in srgb, #fff 25%, transparent)`,
                      }}
                    >
                      {foundryDone ? "Submitted" : foundrySubmitting ? "Submitting…" : "Submit for executive review"}
                    </button>
                  </div>
                  {foundryDone && foundryRow?.completed_at && (
                    <p
                      className="font-mono text-[10px] leading-relaxed"
                      style={{ color: `color-mix(in srgb, ${primary} 50%, #a1a1aa)` }}
                    >
                      Executive queue · {formatLedgerTimestamp(foundryRow.completed_at)} · {foundryRow.verifier_name}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
