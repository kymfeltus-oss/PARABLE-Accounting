"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addAccount } from "@/lib/actions/accounting";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export default function CoaAddAccountSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();

  const onClose = useCallback(() => {
    setOpen(false);
    setFormError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/20"
      >
        <PlusIcon className="h-4 w-4" />
        Add account
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            onClick={onClose}
            aria-label="Close panel"
          />
          <div
            className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0c0c0d] shadow-2xl shadow-black/50"
          >
            <div className="border-b border-white/10 px-5 py-4">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-white">
                New fund / account
              </h2>
              <p id={descId} className="mt-1 text-sm text-white/45">
                Add a line to the master chart without leaving this list. Uses your configured tenant.
              </p>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setFormError(null);
                setPending(true);
                const fd = new FormData(e.currentTarget);
                try {
                  await addAccount(fd);
                  onClose();
                  e.currentTarget.reset();
                  router.refresh();
                } catch (err) {
                  setFormError(err instanceof Error ? err.message : "Could not add account");
                } finally {
                  setPending(false);
                }
              }}
            >
              {formError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {formError}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40" htmlFor="coa-code">
                  Account code
                </label>
                <input
                  id="coa-code"
                  name="account_code"
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="e.g. 4030"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40" htmlFor="coa-name">
                  Account name
                </label>
                <input
                  id="coa-name"
                  name="account_name"
                  type="text"
                  required
                  placeholder="Parable name"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40" htmlFor="coa-category">
                  Category
                </label>
                <select
                  id="coa-category"
                  name="category"
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#0a0a0b] px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500/40"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select category
                  </option>
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Net Asset">Net asset</option>
                  <option value="Income">Income (revenue)</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Normal balance</span>
                <p className="text-xs text-white/35">Must match category (debit: Asset &amp; Expense; credit: others).</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 has-[:checked]:border-cyan-500/40 has-[:checked]:bg-cyan-500/5">
                    <input type="radio" name="normal_balance" value="debit" required className="accent-cyan-500" />
                    <span className="text-sm text-white/80">Debit</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 has-[:checked]:border-cyan-500/40 has-[:checked]:bg-cyan-500/5">
                    <input type="radio" name="normal_balance" value="credit" className="accent-cyan-500" />
                    <span className="text-sm text-white/80">Credit</span>
                  </label>
                </div>
              </div>

              <input type="hidden" name="account_type" value="" />

              <div className="mt-auto flex gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-cyan-400 disabled:opacity-50"
                >
                  {pending ? (
                    "Saving…"
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      Add fund
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
