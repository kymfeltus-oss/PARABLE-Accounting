"use client";

import { useState } from "react";
import { suggestNextSubAccountCode, type CoAAccount } from "@/lib/coaUtils";
import { ChartOfAccountsTable } from "@/components/ledger/ChartOfAccounts";

const CATEGORIES: CoAAccount["category"][] = [
  "Asset",
  "Liability",
  "Net Asset",
  "Income",
  "Expense",
];

type Props = {
  accounts: CoAAccount[];
  loading?: boolean;
  error?: string | null;
  /** When set, a Roll-up total column is shown. Omit until GL posts balances by `id`. */
  balanceByAccountId?: Record<string, number> | null;
  onAddChild: (parent: CoAAccount, p: { account_name: string; account_code: number }) => Promise<void>;
  onAddRoot: (p: { account_name: string; account_code: number; category: string }) => Promise<void>;
  busyId?: string | null;
};

export default function ChartOfAccountsEditor({
  accounts,
  loading = false,
  error = null,
  balanceByAccountId = null,
  onAddChild,
  onAddRoot,
  busyId = null,
}: Props) {
  const [addRootOpen, setAddRootOpen] = useState(false);
  const [addChild, setAddChild] = useState<CoAAccount | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState<string>("");
  const [formCategory, setFormCategory] = useState<CoAAccount["category"]>("Asset");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openAddRoot = () => {
    setAddChild(null);
    setFormName("");
    setFormCode("");
    setFormCategory("Asset");
    setFormErr(null);
    setAddRootOpen(true);
  };

  const openAddChild = (parent: CoAAccount) => {
    const n = suggestNextSubAccountCode(parent, accounts);
    setAddRootOpen(false);
    setFormName("");
    setFormCode(String(n));
    setFormErr(null);
    setAddChild(parent);
  };

  const submit = async () => {
    setFormErr(null);
    const code = Number.parseInt(formCode, 10);
    if (Number.isNaN(code) || code < 100) {
      setFormErr("Enter a valid numeric account code (e.g. 6101).");
      return;
    }
    if (!formName.trim()) {
      setFormErr("Name is required.");
      return;
    }
    setSaving(true);
    try {
      if (addChild) {
        await onAddChild(addChild, { account_name: formName.trim(), account_code: code });
        setAddChild(null);
      } else {
        await onAddRoot({ account_name: formName.trim(), account_code: code, category: formCategory });
        setAddRootOpen(false);
      }
      setFormName("");
      setFormCode("");
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const showRollup = balanceByAccountId != null;

  return (
    <div className="bg-[#050505] min-h-screen p-6 text-white font-sans sm:p-10">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase sm:text-4xl">Chart of Accounts</h1>
          <p className="mt-2 text-[10px] font-bold tracking-[0.4em] text-cyan-400">FINANCIAL ARCHITECTURE // EDIT MODE</p>
        </div>
        <button
          type="button"
          onClick={openAddRoot}
          className="rounded-full bg-cyan-400 px-6 py-2 text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-white"
        >
          + New account
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/5 text-[10px] uppercase tracking-[0.2em] text-white/50">
            <tr>
              <th className="p-4 pl-5 sm:p-6">Code</th>
              <th className="p-4 sm:p-6">Account</th>
              <th className="hidden p-4 sm:table-cell sm:p-6">Category</th>
              {showRollup ? <th className="p-4 text-right sm:p-6">Roll-up total</th> : null}
              <th className="p-4 text-right sm:p-6">Action</th>
            </tr>
          </thead>
          <ChartOfAccountsTable
            accounts={accounts}
            loading={loading}
            showRollup={showRollup}
            balanceByAccountId={showRollup && balanceByAccountId ? balanceByAccountId : null}
            busyId={busyId}
            addSubDisabled={saving}
            onAddSub={openAddChild}
          />
        </table>
      </div>

      {/* Glass modal: add child */}
      {addChild ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-label="Add sub-account"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0a0a0a] p-6 text-white shadow-2xl backdrop-blur-xl sm:p-8">
            <h2 className="text-sm font-black uppercase tracking-[0.25em] text-cyan-400/90">Add sub-account</h2>
            <p className="mt-2 text-xs text-white/50">Under {addChild.account_code} — {addChild.account_name}</p>
            <p className="mt-1 font-mono text-lg text-cyan-300/90">Suggested: {suggestNextSubAccountCode(addChild, accounts)}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50">Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none ring-0 focus:border-cyan-400/50"
                placeholder="e.g. Building repairs — major"
              />
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50">Account code</label>
              <input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full font-mono rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
              />
            </div>
            {formErr ? <p className="mt-2 text-sm text-red-300">{formErr}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddChild(null)}
                className="rounded-full border border-white/15 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="rounded-full bg-cyan-400 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add root */}
      {addRootOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-label="New top-level account"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0a0a0a] p-6 text-white shadow-2xl backdrop-blur-xl sm:p-8">
            <h2 className="text-sm font-black uppercase tracking-[0.25em] text-cyan-400/90">New account</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50">Category (UCOA)</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as CoAAccount["category"])}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50">Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50">Account code</label>
              <input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full font-mono rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                placeholder="e.g. 9001"
              />
            </div>
            {formErr ? <p className="mt-2 text-sm text-red-300">{formErr}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddRootOpen(false)}
                className="rounded-full border border-white/15 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="rounded-full bg-cyan-400 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

