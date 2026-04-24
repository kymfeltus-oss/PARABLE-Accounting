"use client";

import { useCallback, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { taskListForGate, toReportingPeriod, type CloseTaskDef } from "@/lib/close/closeChecklistConfig";
import { saveCloseChecklistItem, type CloseChecklistRow, type StaffRow } from "@/lib/close/closeChecklistData";
import { TENANT_GLOW_FALLBACK } from "@/lib/brandCss";

function formatAttestationLine(name: string, completedAt: string): string {
  const t = new Date(completedAt);
  const d = t.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${name} — ${d} (Northlake)`;
}

/** Gate 1 tithes: institutional line with role label (CFO) + timestamp */
function formatGate1SecuredLine(name: string, completedAt: string): string {
  const t = new Date(completedAt);
  const ts = t.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `Verified by ${name} (CFO) · ${ts}`;
}

type Props = {
  gateNumber: 1 | 2 | 3 | 4;
  monthStart: string;
  tenantId: string;
  supabase: SupabaseClient;
  taskDefs?: CloseTaskDef[];
  staff: StaffRow[];
  rows: Map<string, CloseChecklistRow>;
  onSaved: () => void;
  /** Suffix for G1 label, e.g. "04/26" */
  periodLabel: string;
};

export default function CloseChecklistPanel({
  gateNumber,
  monthStart,
  tenantId,
  supabase,
  taskDefs: taskDefsProp,
  staff,
  rows,
  onSaved,
  periodLabel,
}: Props) {
  const tasks = taskDefsProp ?? taskListForGate(gateNumber);
  const reportingPeriod = useMemo(() => toReportingPeriod(monthStart), [monthStart]);
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [localPick, setLocalPick] = useState<Record<string, string>>({});

  const markTask = useCallback(
    async (def: CloseTaskDef, checked: boolean) => {
      setErr(null);
      if (!checked) {
        return;
      }
      const pick = localPick[def.key] || "";
      if (!pick) {
        setErr("Select a person from the list before attesting.");
        return;
      }
      const staffRow = staff.find((s) => s.id === pick);
        const name = staffRow?.staff_name?.trim() || "Staff";
        setSaving(def.key);
        try {
        const r = await saveCloseChecklistItem(supabase, {
          tenantId,
          reportingPeriod,
          gateNumber,
          taskName: def.key,
          verifierName: name,
          verifierStaffId: pick,
        });
        if (r.error) {
          setErr(r.error);
          return;
        }
        onSaved();
      } finally {
        setSaving(null);
      }
    },
    [gateNumber, localPick, onSaved, reportingPeriod, staff, supabase, tenantId]
  );

  return (
    <div
      className="mt-3 space-y-2 rounded-xl border bg-black/20 p-3 sm:p-4"
      style={{
        borderColor: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 16%, #27272a)`,
      }}
    >
      <p
        className="text-[9px] font-bold uppercase tracking-[0.2em]"
        style={{ color: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 55%, #a1a1aa)` }}
      >
        Institutional close checklist (Gate {gateNumber})
      </p>
      {err && <p className="text-xs text-amber-200/90">{err}</p>}
      {tasks.map((def) => {
        const ext = rows.get(def.key);
        const done = Boolean(ext?.verifier_name && ext?.completed_at);
        const staffIdForRow =
          ext?.verifier_staff_id && staff.some((s) => s.id === ext.verifier_staff_id)
            ? ext.verifier_staff_id
            : ext?.verifier_name
              ? (staff.find((s) => s.staff_name === ext.verifier_name)?.id ?? "")
              : "";
        const labelText =
          def.key === "g1_tithes_offerings"
            ? `All tithes and offerings posted for ${periodLabel}`
            : def.label;
        return (
          <div
            key={def.key}
            className={[
              "flex flex-col gap-2 border-b border-zinc-800/50 py-2 last:border-0",
              def.isSubItem ? "pl-2 sm:pl-4" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-200">{def.isSubItem ? `· ${labelText}` : labelText}</p>
                {done && ext && (
                  <p
                    className="mt-0.5 font-mono text-[10px] sm:text-xs"
                    style={{ color: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 88%, #e4e4e7)` }}
                  >
                    {def.key === "g1_tithes_offerings"
                      ? formatGate1SecuredLine(ext.verifier_name || "—", ext.completed_at)
                      : formatAttestationLine(ext.verifier_name || "—", ext.completed_at)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label className="text-[9px] uppercase text-zinc-500">Attested by</label>
                <select
                  className="max-w-[10rem] rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200"
                  value={localPick[def.key] ?? (done ? staffIdForRow : "")}
                  disabled={done}
                  onChange={(e) => setLocalPick((m) => ({ ...m, [def.key]: e.target.value }))}
                  aria-label={`Verifier for ${def.key}`}
                >
                  <option value="">— Select —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.staff_name}
                    </option>
                  ))}
                </select>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600"
                    checked={done}
                    disabled={done || saving === def.key}
                    onChange={(e) => {
                      void markTask(def, e.target.checked);
                    }}
                  />
                  Done
                </label>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
