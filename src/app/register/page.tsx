"use client";

import Link from "next/link";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Lock } from "lucide-react";

const field =
  "h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-[var(--brand-cyber)] focus:ring-2 focus:ring-[var(--brand-cyber)]/30";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [marketing, setMarketing] = useState(true);
  const [busy, setBusy] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase =
    supabaseUrl && supabaseAnonKey
      ? createBrowserClient(supabaseUrl, supabaseAnonKey)
      : null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      window.alert("Please enter email and password.");
      return;
    }
    if (!supabase) {
      window.alert("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          phone: phone.trim() || null,
          marketing_opt_in: marketing,
          plan_selection: "plus_trial",
        },
      },
    });
    setBusy(false);
    if (error) window.alert(error.message);
    else window.location.href = "/member";
  };

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 flex" aria-hidden>
        <div className="h-full w-1/2 bg-[#0a1628]" />
        <div className="h-full w-1/2 bg-[#0f1b2e]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col bg-transparent px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <img src="/logo.svg" alt="" className="h-8 w-auto" />
            <span className="text-sm font-semibold text-slate-100 sm:text-base">Accounting</span>
          </Link>
          <a href="tel:18777825795" className="shrink-0 text-sm text-slate-200/90 sm:text-sm">
            For sales: 1-877-782-5795
          </a>
        </div>

        <div className="my-auto flex w-full flex-1 items-center justify-center py-8">
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_80px_-20px_rgba(0,0,0,0.45)] md:max-w-5xl"
          >
            <div className="flex flex-col md:min-h-[min(640px,85vh)] md:flex-row">
              <div className="w-full border-slate-200 p-6 sm:p-8 md:w-[55%] md:border-r">
                <div className="mb-7 flex items-center gap-2">
                  <img src="/logo.svg" alt="" className="h-6 w-auto" />
                  <span className="text-sm font-bold text-slate-800 sm:text-base">Parable</span>
                </div>
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                  Let&apos;s get you in
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">30-day free trial · no charge until the trial ends</p>

                <form onSubmit={handleRegister} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Email address
                    </label>
                    <input
                      id="reg-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      className={field}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="reg-pw" className="text-sm font-medium text-slate-700">
                        Password
                      </label>
                      <button
                        type="button"
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                        onClick={() => setShowPw((s) => !s)}
                      >
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                      <input
                        id="reg-pw"
                        name="password"
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        className={field + " pl-10 pr-3.5"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Phone
                    </label>
                    <input
                      id="reg-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      className={field}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 000-0000"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      We use this to protect your account and for important verification messages.
                    </p>
                  </div>

                  <label className="mt-1 flex cursor-pointer gap-2.5 text-xs leading-relaxed text-slate-600">
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(e) => setMarketing(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    I agree to receive helpful product and ministry-accounting tips. You can unsubscribe at any time.
                    Parable&apos;s use of your data is subject to our policies.
                  </label>

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border-2 border-cyan-500/20 py-3.5 text-sm font-bold uppercase tracking-wide text-slate-950 transition hover:brightness-105 disabled:opacity-60"
                    style={{ backgroundColor: "var(--brand-cyber)" }}
                  >
                    <Lock className="h-4 w-4" />
                    {busy ? "Creating account…" : "Create a Parable account"}
                  </button>
                </form>

                <p className="mt-5 text-center text-[11px] text-slate-500">
                  By creating an account you accept our terms and privacy policy.
                </p>
                <p className="mt-4 text-center text-sm text-slate-600">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-[#0a1628] hover:underline">
                    Sign in
                  </Link>
                </p>
                <p className="mt-3 text-center text-xs">
                  <Link href="/register/full" className="text-slate-500 underline decoration-slate-300 hover:text-slate-800">
                    Full institutional onboarding (advanced)
                  </Link>
                </p>
              </div>

              <aside className="flex w-full flex-col justify-between bg-slate-100/80 p-6 sm:p-8 md:w-[45%] md:bg-slate-100/60">
                <div>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">Your current plan</p>
                    <span className="shrink-0 rounded-md bg-fuchsia-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                      Free trial
                    </span>
                  </div>
                  <p className="text-base font-bold text-slate-900 sm:text-lg">Parable Accounting — Plus</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">$57.50</p>
                  <p className="text-sm text-slate-500">/month (after 50% intro period*)</p>
                  <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                    <li className="flex gap-2">
                      <span className="mt-0.5 text-[var(--brand-cyber)]" aria-hidden>
                        ✓
                      </span>{" "}
                      Classes &amp; locations, budgets, and comprehensive reporting
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-0.5 text-[var(--brand-cyber)]" aria-hidden>
                        ✓
                      </span>{" "}
                      Share access with 5 users (expand as you grow)
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-0.5 text-[var(--brand-cyber)]" aria-hidden>
                        ✓
                      </span>{" "}
                      Guided intelligence &amp; AI-assisted close workflows
                    </li>
                  </ul>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    You won&apos;t be charged today. Billing begins when your 30-day trial ends, unless you cancel
                    first.
                  </p>
                </div>

                <div className="mt-6 border-t border-slate-200/90 pt-4 text-sm text-slate-600">
                  <div className="flex justify-between gap-2">
                    <span>Recurring</span>
                    <span className="text-right font-medium">$57.50/mo</span>
                  </div>
                  <p className="text-xs text-slate-500">After 1-month free trial · taxes not included</p>
                  <div className="mt-3 flex items-end justify-between border-t border-slate-200 pt-3">
                    <span className="text-base font-bold text-slate-900">Total due today</span>
                    <span className="text-2xl font-bold text-slate-900">$0</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
