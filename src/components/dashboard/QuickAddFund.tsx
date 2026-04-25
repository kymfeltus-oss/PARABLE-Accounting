"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addAccount } from "@/lib/actions/accounting";

export default function QuickAddFund() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4 shadow-lg shadow-cyan-500/5 ring-1 ring-cyan-500/15"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setPending(true);
        try {
          const fd = new FormData(e.currentTarget);
          await addAccount(fd);
          (e.target as HTMLFormElement).reset();
          router.refresh();
        } catch (x) {
          setErr(x instanceof Error ? x.message : "Insert failed");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-500">Add fund</h2>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-cyan-500 px-5 py-2 text-xs font-bold uppercase tracking-widest text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add fund"}
        </button>
      </div>
      {err ? <p className="mb-3 text-sm text-red-400">{err}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Code
          <input
            name="account_code"
            required
            type="text"
            inputMode="numeric"
            placeholder="4030"
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:col-span-2">
          Name
          <input
            name="account_name"
            required
            type="text"
            placeholder="Operating – unrestricted"
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Category
          <select
            name="category"
            required
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>
              Select
            </option>
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Net Asset">Net asset</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
        </label>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Normal
          <div className="mt-1 flex gap-2">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1.5 text-xs font-medium text-slate-300 has-[:checked]:border-cyan-500/50 has-[:checked]:text-cyan-200">
              <input type="radio" name="normal_balance" value="debit" required className="accent-cyan-500" />
              Dr
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1.5 text-xs font-medium text-slate-300 has-[:checked]:border-cyan-500/50 has-[:checked]:text-cyan-200">
              <input type="radio" name="normal_balance" value="credit" className="accent-cyan-500" />
              Cr
            </label>
          </div>
        </div>
        <input type="hidden" name="account_type" value="" />
      </div>
    </form>
  );
}
