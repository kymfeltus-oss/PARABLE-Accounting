"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Lock } from "lucide-react";
import {
  ADD_ONS,
  formatUsd,
  getPlanById,
  getStandardMonthlyPlanPrice,
  loadSelectedPlan,
  saveSelectedPlan,
  type PlanId,
} from "@/lib/pricing";
import { addLocalCalendarDays, formatDateLongLocal, toLocalIsoDate } from "@/lib/trial";

const field =
  "h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-[var(--brand-cyber)] focus:ring-2 focus:ring-[var(--brand-cyber)]/30";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [marketing, setMarketing] = useState(true);
  const [includeGiving, setIncludeGiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [planId, setPlanId] = useState<PlanId>("plus");
  const [planName, setPlanName] = useState("Plus");
  const [baseMonthlyPrice, setBaseMonthlyPrice] = useState(getPlanById("plus")?.monthlyPrice ?? 57.5);
  const [discountLabel, setDiscountLabel] = useState("50% off for 3 months*");
  const [freeTrial30, setFreeTrial30] = useState(true);
  const [trialEndPhrase, setTrialEndPhrase] = useState("");
  const [setupCancelledNotice, setSetupCancelledNotice] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase =
    supabaseUrl && supabaseAnonKey
      ? createBrowserClient(supabaseUrl, supabaseAnonKey)
      : null;

  useEffect(() => {
    const selected = loadSelectedPlan();
    if (!selected) return;
    setPlanId(selected.planId);
    setPlanName(selected.planName);
    setBaseMonthlyPrice(selected.monthlyPrice);
    if (selected.discountLabel) setDiscountLabel(selected.discountLabel);
    if (selected.freeTrial30Day !== undefined) setFreeTrial30(selected.freeTrial30Day);
  }, []);

  const persistFreeTrial = (next: boolean) => {
    setFreeTrial30(next);
    saveSelectedPlan({
      planId,
      planName,
      monthlyPrice: baseMonthlyPrice,
      discountLabel,
      freeTrial30Day: next,
    });
  };

  useEffect(() => {
    const end = addLocalCalendarDays(new Date(), 30);
    setTrialEndPhrase(formatDateLongLocal(end));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("trial_setup") === "cancelled") {
      setSetupCancelledNotice(true);
      window.history.replaceState({}, "", "/register");
    }
  }, []);

  const monthlyAddOns = includeGiving ? ADD_ONS.givingMonthly : 0;
  const recurringMonthlyTotal = useMemo(() => baseMonthlyPrice + monthlyAddOns, [baseMonthlyPrice, monthlyAddOns]);
  const totalDueToday = useMemo(
    () => (freeTrial30 ? 0 : recurringMonthlyTotal),
    [freeTrial30, recurringMonthlyTotal],
  );

  const planRow = useMemo(() => getPlanById(planId), [planId]);
  const standardBaseMonthly = planRow ? getStandardMonthlyPlanPrice(planRow) : baseMonthlyPrice;
  const postIntroMonthlyTotal = useMemo(
    () => standardBaseMonthly + monthlyAddOns,
    [standardBaseMonthly, monthlyAddOns],
  );

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
    const now = new Date();
    const trialEnd = addLocalCalendarDays(now, 30);
    const trialEndsOn = toLocalIsoDate(trialEnd);
    const trialEndsDisplay = formatDateLongLocal(trialEnd);

    setBusy(true);
    // Supabase Auth Hook or custom SMTP template can send a “Trial starting” email using user_metadata
    // (trial_ends_on, trial_ends_display, subscription_rate_after_trial, plan_name).
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          phone: phone.trim() || null,
          marketing_opt_in: marketing,
          plan_selection: planId,
          plan_name: planName,
          plan_monthly_total: recurringMonthlyTotal,
          plan_monthly_standard_total: postIntroMonthlyTotal,
          plan_monthly_intro_base: baseMonthlyPrice,
          plan_monthly_standard_base: standardBaseMonthly,
          plan_discount: discountLabel,
          giving_add_on: includeGiving,
          trial_started_on: toLocalIsoDate(now),
          trial_ends_on: trialEndsOn,
          trial_ends_display: trialEndsDisplay,
          trial_duration_days: 30,
          subscription_rate_after_trial: recurringMonthlyTotal,
          subscription_rate_after_intro: postIntroMonthlyTotal,
          trial_disclosure_version: "2026-04",
          free_trial_30_selected: freeTrial30,
          checkout_due_today: totalDueToday,
        },
      },
    });
    if (error) {
      setBusy(false);
      window.alert(error.message);
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (freeTrial30) {
      try {
        const setupRes = await fetch("/api/stripe/create-trial-setup-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            successUrl: `${origin}/login?trial_setup=1&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/register?trial_setup=cancelled`,
            planId,
            planName,
          }),
        });
        if (setupRes.ok) {
          const j = (await setupRes.json()) as { url?: string };
          if (j.url) {
            window.location.href = j.url;
            return;
          }
        }
      } catch {
        /* Stripe optional — continue to app */
      }
    }
    setBusy(false);
    window.location.href = "/member";
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
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Contact
          </Link>
        </div>

        <div className="my-auto flex w-full flex-1 items-center justify-center py-8">
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_80px_-20px_rgba(0,0,0,0.45)] md:max-w-5xl"
          >
            <div className="flex flex-col md:min-h-[min(640px,85vh)] md:flex-row">
              <div className="w-full border-slate-200 p-6 sm:p-8 md:w-[55%] md:border-r">
                <div className="mb-7 flex items-center gap-2">
                  <img src="/logo.svg" alt="" className="h-6 w-auto" />
                  <span className="text-sm font-bold text-slate-800 sm:text-base">Accounting</span>
                </div>
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                  Let&apos;s get you in
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">30-day free trial · no charge until the trial ends</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md border border-fuchsia-500/30 bg-fuchsia-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white sm:text-xs">
                    Free trial
                  </span>
                  <span className="text-xs text-slate-600 sm:text-sm">
                    Selected plan: <span className="font-semibold text-slate-800">{planName}</span>
                  </span>
                </div>

                {setupCancelledNotice && (
                  <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    Card setup was cancelled. Your trial can still begin — add a payment method in billing before the
                    trial ends to avoid interruption.
                  </p>
                )}

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

                  <div className="rounded-lg border border-cyan-500/25 bg-[#0a1628] p-3.5 text-left font-sans shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                    {freeTrial30 ? (
                      <p className="text-[11px] leading-relaxed text-slate-100 sm:text-xs sm:leading-relaxed">
                        Your 30-day free trial begins today. You will not be charged during the trial period. To avoid
                        being charged, please cancel before{" "}
                        <span className="whitespace-nowrap font-semibold text-white">
                          {trialEndPhrase || "the trial end date shown in your confirmation email"}
                        </span>
                        . If not canceled, your card will be automatically charged{" "}
                        <span className="whitespace-nowrap font-semibold text-white">{formatUsd(recurringMonthlyTotal)}</span> at
                        the end of the trial (plus applicable taxes).
                      </p>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-slate-100 sm:text-xs sm:leading-relaxed">
                        Free trial is off. Your payment method will be charged{" "}
                        <span className="font-semibold text-white">{formatUsd(recurringMonthlyTotal)}</span> today for your
                        selected plan{includeGiving ? " including PARABLE Giving" : ""}, plus applicable taxes.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border-2 border-cyan-500/20 py-3.5 text-sm font-bold uppercase tracking-wide text-slate-950 transition hover:brightness-105 disabled:opacity-60"
                    style={{ backgroundColor: "var(--brand-cyber)" }}
                  >
                    <Lock className="h-4 w-4" />
                    {busy
                      ? "Submitting…"
                      : freeTrial30
                        ? "Start 30-day free trial"
                        : `Pay ${formatUsd(totalDueToday)} & create account`}
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
                    Full Ministry Onboarding
                  </Link>
                </p>
              </div>

              <aside className="flex w-full flex-col justify-between bg-slate-100/80 p-6 sm:p-8 md:w-[45%] md:bg-slate-100/60">
                <div>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">Your current plan</p>
                    <span className="shrink-0 rounded-md border border-fuchsia-400/40 bg-fuchsia-600 px-2.5 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-white shadow-sm sm:text-xs">
                      <span className="block">Free trial</span>
                      <span className="mt-0.5 block text-[9px] font-semibold normal-case tracking-normal text-fuchsia-100">
                        30 days
                      </span>
                    </span>
                  </div>
                  <p className="text-base font-bold text-slate-900 sm:text-lg">Parable Accounting — {planName}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">{formatUsd(baseMonthlyPrice)}</p>
                  <p className="text-sm text-slate-500">/month (50% intro for 3 paid months after trial*)</p>
                  <p className="mt-2 rounded-md border border-slate-200 bg-white/90 px-3 py-2 text-xs leading-relaxed text-slate-700">
                    <span className="font-semibold text-slate-900">After the 3-month intro discount ends:</span>{" "}
                    <span className="tabular-nums font-bold text-slate-900">{formatUsd(postIntroMonthlyTotal)}/mo</span>{" "}
                    standard recurring total
                    {includeGiving ? " (includes PARABLE Giving)" : ""}. Applies from month 4 of paid billing onward;
                    plus applicable taxes.
                  </p>
                  <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <span>Add PARABLE Giving (+{formatUsd(ADD_ONS.givingMonthly)}/mo)</span>
                    <input
                      type="checkbox"
                      checked={includeGiving}
                      onChange={(e) => {
                        setIncludeGiving(e.target.checked);
                        saveSelectedPlan({
                          planId,
                          planName,
                          monthlyPrice: baseMonthlyPrice,
                          discountLabel,
                          freeTrial30Day: freeTrial30,
                        });
                      }}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>

                  <div className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                    <span className="min-w-0 pr-2">
                      <span className="font-semibold text-slate-900">30-day free trial</span>
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        {freeTrial30 ? "$0 due today — card setup optional" : "Off — pay first cycle today"}
                      </span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={freeTrial30}
                      onClick={() => persistFreeTrial(!freeTrial30)}
                      className={
                        "relative flex h-9 w-[3.4rem] shrink-0 items-center rounded-full p-0.5 transition " +
                        (freeTrial30
                          ? "border-2 border-cyan-700/80 bg-[var(--brand-cyber)]"
                          : "border-2 border-slate-400 bg-slate-300")
                      }
                    >
                      <span
                        className={
                          "h-7 w-7 rounded-full border-2 border-slate-200 bg-white transition-transform duration-200 " +
                          (freeTrial30 ? "translate-x-[1.32rem]" : "translate-x-0.5")
                        }
                      />
                    </button>
                  </div>
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
                    first. Intro pricing applies for the first three paid monthly cycles; then the standard rate
                    above.
                  </p>
                  <p className="mt-2 text-[10px] leading-snug text-slate-400">*Estimated schedule; see terms for billing dates.</p>
                </div>

                <div className="mt-6 border-t border-slate-200/90 pt-4 text-sm text-slate-600">
                  <div className="flex justify-between gap-2">
                    <span>Intro recurring (after trial)*</span>
                    <span className="text-right font-medium">{formatUsd(recurringMonthlyTotal)}/mo</span>
                  </div>
                  {includeGiving && (
                    <div className="mt-1 flex justify-between gap-2 text-xs text-slate-500">
                      <span>PARABLE Giving add-on</span>
                      <span>{formatUsd(ADD_ONS.givingMonthly)}/mo</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between gap-2 border-t border-slate-200/80 pt-2 text-xs text-slate-600">
                    <span>Standard recurring (after 3 intro months)</span>
                    <span className="text-right font-semibold text-slate-800">{formatUsd(postIntroMonthlyTotal)}/mo</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">After 30-day free trial · taxes not included</p>
                  <div className="mt-3 flex items-end justify-between border-t border-slate-200 pt-3">
                    <span className="text-base font-bold text-slate-900">Total due today</span>
                    <span className="text-2xl font-bold tabular-nums text-slate-900">{formatUsd(totalDueToday)}</span>
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
