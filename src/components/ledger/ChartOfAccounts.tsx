"use client";

import { useCallback, useMemo, useState } from "react";
import {
  collectByParent,
  getAccountTotal,
  type CoAAccount,
} from "@/lib/coaUtils";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type LockProfile = (a: CoAAccount) => boolean;

const defaultIsRestrictedVisually: LockProfile = (a) => {
  if (a.is_restricted) return true;
  const c = a.account_code;
  if (c >= 1100 && c < 1200) return true;
  if (c >= 3200 && c < 3300) return true;
  return false;
};

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-label="Restricted">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <span
      className="text-amber-300/90 font-mono text-sm transition-transform"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
      aria-hidden
    >
      {">"}
    </span>
  );
}

export type ChartOfAccountsTableProps = {
  accounts: CoAAccount[];
  loading: boolean;
  showRollup: boolean;
  balanceByAccountId: Record<string, number> | null;
  busyId: string | null;
  /** When a modal save is in flight, disable all Add sub actions. */
  addSubDisabled?: boolean;
  onAddSub: (parent: CoAAccount) => void;
  isRestrictedProfile?: LockProfile;
};

type RenderRow = {
  kind: "root-header" | "row";
  account: CoAAccount;
  depth: number;
  parentCode: number | null;
};

function buildVisibleRows(accounts: CoAAccount[], collapsed: Set<string>): RenderRow[] {
  const m = collectByParent(accounts);
  const idToAccount = new Map(accounts.map((a) => [a.id, a] as const));
  const out: RenderRow[] = [];
  const roots = m.get(null) ?? [];

  for (const root of roots) {
    const kids = m.get(root.id) ?? [];
    const hasKids = kids.length > 0;
    if (!hasKids) {
      out.push({ kind: "row", account: root, depth: 0, parentCode: null });
      continue;
    }

    out.push({ kind: "root-header", account: root, depth: 0, parentCode: null });
    if (collapsed.has(root.id)) continue;

    const visit = (parentId: string, depth: number) => {
      for (const child of m.get(parentId) ?? []) {
        const p = idToAccount.get(parentId);
        out.push({
          kind: "row",
          account: child,
          depth,
          parentCode: p ? p.account_code : null,
        });
        visit(child.id, depth + 1);
      }
    };
    visit(root.id, 1);
  }

  return out;
}

export function ChartOfAccountsTable({
  accounts,
  loading,
  showRollup,
  balanceByAccountId,
  busyId,
  addSubDisabled = false,
  onAddSub,
  isRestrictedProfile = defaultIsRestrictedVisually,
}: ChartOfAccountsTableProps) {
  const m = useMemo(() => collectByParent(accounts), [accounts]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const visibleRows = useMemo(() => buildVisibleRows(accounts, collapsed), [accounts, collapsed]);

  const toggle = useCallback((rootId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  }, []);

  const colSpan = showRollup ? 5 : 4;
  return (
    <tbody className="divide-y divide-white/5">
      {loading && accounts.length === 0 ? (
        <tr>
          <td colSpan={colSpan} className="p-6 text-center text-white/50">
            Loading…
          </td>
        </tr>
      ) : null}

      {visibleRows.map((row) => {
        const a = row.account;
        if (row.kind === "root-header") {
          const isExpanded = !collapsed.has(a.id);
          return (
            <tr key={`h-${a.id}`} className="group transition-colors hover:bg-amber-400/5">
              <td
                colSpan={colSpan}
                className="p-0"
                data-parent-code={a.account_code}
                data-hierarchy="parent"
              >
                <div
                  className="flex w-full min-w-0 items-stretch border-l-4 border-amber-400/80 bg-amber-950/10 ring-1 ring-amber-400/40 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.15)]"
                >
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-amber-500/5 sm:pl-5"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} section ${a.account_code}`}
                  >
                    <IconChevron open={isExpanded} />
                    <span className="font-mono text-base font-bold tabular-nums text-amber-100/95">{a.account_code}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold uppercase tracking-tight text-amber-100/90">{a.account_name}</span>
                    {isRestrictedProfile(a) && (
                      <span className="shrink-0" title="Restricted">
                        <IconLock className="text-violet-400/90" />
                      </span>
                    )}
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-amber-200/50">Sovereign</span>
                  </button>
                  <div className="flex shrink-0 items-center pr-2 sm:pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSub(a);
                      }}
                      disabled={addSubDisabled || busyId === a.id}
                      className="whitespace-nowrap border border-amber-400/30 px-2 py-1.5 text-[9px] font-bold uppercase tracking-tighter text-amber-200/80 opacity-0 transition group-hover:opacity-100 hover:border-amber-300/60 sm:px-3"
                    >
                      {busyId === a.id ? "…" : "Add sub"}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          );
        }

        const d = row.depth;
        const isSub = d > 0;
        const isStandaloneRoot = d === 0;
        const indentPx = 12 + d * 18;
        const restricted = isRestrictedProfile(a);
        const hKids = (m.get(a.id) ?? []).length > 0;
        const isBusy = busyId === a.id;
        return (
          <tr
            key={a.id}
            className="group transition-colors hover:bg-cyan-500/[0.04]"
            data-parent-code={row.parentCode ?? undefined}
            data-hierarchy={isSub ? "child" : "root-leaf"}
          >
            <td className="p-2 align-top pl-0 sm:p-3">
              <div
                className="flex min-w-0 items-start gap-1.5 pl-0"
                style={{ marginLeft: indentPx }}
              >
                {isSub && <div className="mt-0.5 w-0 shrink-0 self-stretch border-l-2 border-cyan-500/30" style={{ minHeight: "1.4rem" }} aria-hidden />}
                <span
                  className={
                    isSub
                      ? "break-words font-mono text-sm font-medium tabular-nums text-cyan-300"
                      : "break-words font-mono text-sm font-medium tabular-nums text-zinc-200/95"
                  }
                >
                  {a.account_code}
                </span>
                {restricted && (
                  <span className="ml-0.5 shrink-0" title="Restricted (Sovereign lock)">
                    <IconLock className="text-violet-400/90" />
                  </span>
                )}
              </div>
            </td>
            <td className="p-2 pl-0 font-medium sm:p-3">
              <div
                className={
                  isSub
                    ? `min-w-0 pl-0 ${!hKids ? "text-cyan-100" : "text-cyan-200/85"}`
                    : "min-w-0 pl-0 text-zinc-100/90"
                }
              >
                {a.account_name}
              </div>
              {a.sub_category ? (
                <div
                  className={
                    isSub
                      ? "mt-0.5 text-[10px] uppercase tracking-wider text-cyan-200/30"
                      : "mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500/80"
                  }
                >
                  {a.sub_category}
                </div>
              ) : null}
            </td>
            <td className="hidden p-3 sm:table-cell">
              <span className={`text-xs ${isSub ? "text-cyan-100/45" : "text-zinc-400"}`}>{a.category}</span>
              {a.is_restricted && !restricted && <span className="ml-2 text-[9px] text-amber-200/50">Flagged</span>}
            </td>
            {showRollup && balanceByAccountId ? (
              <td className={`p-3 text-right font-mono sm:p-3 ${isSub ? "text-cyan-100/70" : "text-zinc-200/80"}`}>
                {fmt.format(getAccountTotal(a.account_code, accounts, balanceByAccountId))}
              </td>
            ) : null}
            <td className="p-2 text-right sm:p-3">
              <button
                type="button"
                onClick={() => void onAddSub(a)}
                disabled={isBusy || addSubDisabled}
                className={`border px-2 py-1 text-[9px] uppercase tracking-tighter opacity-0 transition group-hover:opacity-100 sm:px-3 ${
                  isStandaloneRoot
                    ? "border-white/20 text-zinc-300/70 hover:border-white/40 hover:text-zinc-200"
                    : "border-white/20 text-cyan-200/60 hover:border-cyan-400/50 hover:text-cyan-200"
                }`}
              >
                {isBusy ? "…" : "Add sub"}
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

export { defaultIsRestrictedVisually };
