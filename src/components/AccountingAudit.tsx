import { getSupabaseServerAnon } from "@/lib/supabase/server-anon";

export type AccountingAlertRow = {
  account_code: number;
  account_name: string;
  health_status: string;
  normal_balance: string;
  tenant_id?: string;
};

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  /** When set, filters alerts for this tenant (if the view exposes `tenant_id`). */
  tenantId?: string;
};

/**
 * Renders rows from `parable_ledger.view_accounting_alerts` (create the view in Supabase).
 * Renders nothing when the view is missing, empty, or the query errors.
 */
export default async function AccountingAudit({ tenantId }: Props) {
  const supabase = getSupabaseServerAnon();
  if (!supabase) return null;

  let q = supabase.from("view_accounting_alerts").select("*");
  if (tenantId) {
    q = q.eq("tenant_id", tenantId);
  }
  const { data: alerts, error } = await q;

  if (error) return null;
  if (!alerts?.length) return null;

  const rows = alerts as AccountingAlertRow[];

  return (
    <div className="mb-6 space-y-3" role="region" aria-label="Accounting audit alerts">
      {rows.map((alert, i) => (
        <div
          key={`${String(alert.account_code)}-${alert.account_name}-${i}`}
          className="flex gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-left shadow-[0_0_0_1px_rgba(248,113,113,0.2)]"
        >
          <AlertIcon className="h-4 w-4 shrink-0 text-red-300" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-tight text-red-200/95">
              Institutional audit alert: abnormal balance
            </p>
            <p className="mt-1 text-sm text-red-100/90">
              Account <strong className="font-semibold text-white">{alert.account_code}</strong> (
              <strong className="font-medium">{alert.account_name}</strong>) is showing a{" "}
              <strong>{alert.health_status}</strong>. Normal balance should be{" "}
              {String(alert.normal_balance ?? "").toUpperCase() || "—"}.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
