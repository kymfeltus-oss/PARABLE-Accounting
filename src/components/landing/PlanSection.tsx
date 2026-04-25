"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, PlayCircle, Sparkles, ChevronUp } from "lucide-react";
import SmallBusinessPlanColumns from "@/components/landing/SmallBusinessPlanColumns";

type Segment = "small" | "midsize";

export default function PlanSection() {
  const [segment, setSegment] = useState<Segment>("small");
  const [freeTrial, setFreeTrial] = useState(true);

  return (
    <section
      id="plans"
      className="scroll-mt-24 bg-white text-slate-900"
      role="region"
      aria-label="Plan selection"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
        <h2 className="text-center text-4xl font-medium tracking-tight md:text-6xl">
          Connected intelligence. One solution.
        </h2>

        <div className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-2.5 sm:mt-10 sm:flex-row sm:items-stretch sm:justify-center sm:gap-3">
          <button
            type="button"
            onClick={() => setSegment("small")}
            aria-pressed={segment === "small"}
            className={
              segment === "small"
                ? "w-full min-h-[3rem] rounded-lg border border-slate-950 bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white sm:w-[min(100%,220px)]"
                : "w-full min-h-[3rem] rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm sm:w-[min(100%,220px)]"
            }
          >
            Small ministry
          </button>
          <button
            type="button"
            onClick={() => setSegment("midsize")}
            aria-pressed={segment === "midsize"}
            className={
              segment === "midsize"
                ? "w-full min-h-[3rem] rounded-lg border border-slate-950 bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white sm:w-[min(100%,220px)]"
                : "w-full min-h-[3rem] rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm sm:w-[min(100%,220px)]"
            }
          >
            Mid-size ministry
          </button>
        </div>

        <div className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-2 border-b border-t border-slate-200 py-3 text-[10px] font-semibold sm:grid-cols-3 sm:gap-3 sm:py-4 sm:text-xs">
          <p className="flex items-center justify-center gap-2 text-center text-slate-900">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[9px] text-white">
              1
            </span>
            Select plan
          </p>
          <p className="flex items-center justify-center gap-1.5 text-center text-slate-500">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] text-slate-600">
              2
            </span>
            Add Payroll (optional)
          </p>
          <p className="flex items-center justify-center gap-1.5 text-center text-slate-500">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] text-slate-600">
              3
            </span>
            Checkout
          </p>
        </div>

        <div className="mx-auto mt-6 flex w-full max-w-4xl flex-col items-stretch justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-4 sm:mt-8 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
          <p className="min-w-0 text-left text-sm font-medium leading-snug text-slate-800">
            <span className="font-bold text-slate-950">
              50% off
            </span>{" "}
            for 3 months* and
            <br className="hidden sm:block" />{" "}
            <span className="whitespace-nowrap sm:whitespace-normal">Live Expert Assisted FREE for 30 days*</span>
            <span className="mt-1 block text-xs font-normal text-slate-600">
              Choose plan first, add payroll, then checkout
            </span>
          </p>
          <div className="flex shrink-0 items-center justify-center gap-3 sm:justify-end">
            <span
              className="text-sm font-bold text-slate-900"
              id="free-trial-label"
            >
              Free trial for 30 days
            </span>
            <button
              type="button"
              onClick={() => setFreeTrial((v) => !v)}
              role="switch"
              aria-checked={freeTrial}
              aria-labelledby="free-trial-label"
              className={
                "relative flex h-9 w-[3.4rem] shrink-0 items-center rounded-full p-0.5 transition " +
                (freeTrial
                  ? "border-2 border-cyan-700/80 bg-[var(--brand-cyber)]"
                  : "border-2 border-slate-500 bg-slate-300")
              }
            >
              <span
                className={
                  "h-7 w-7 rounded-full border-2 border-slate-200 bg-white transition-transform duration-200 " +
                  (freeTrial ? "translate-x-[1.32rem]" : "translate-x-0.5")
                }
              />
            </button>
            <span
              className="w-8 text-center text-[10px] font-black uppercase tabular-nums text-slate-600"
              aria-hidden
            >
              {freeTrial ? <span className="font-extrabold text-[var(--brand-cyber)]">On</span> : "Off"}
            </span>
          </div>
        </div>

        {segment === "small" ? (
          <SmallBusinessPlanColumns />
        ) : (
          <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
            <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-950 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-white">
                Best of Accounting
              </div>
              <div className="p-5 sm:p-6">
                <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">Advanced</h3>
                <p className="mt-1 text-base text-slate-600">Boost profits with greater clarity</p>
                <div className="mt-5 flex items-end gap-2">
                  <p className="text-sm text-slate-400 line-through">$275</p>
                  <p className="text-3xl font-bold sm:text-4xl">$137.50</p>
                  <p className="text-sm text-slate-500">/mo</p>
                </div>
                <p className="mt-1 text-xs text-slate-600">Save 50% for 3 months*</p>
                <Link
                  href="/register"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-slate-950 px-3 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-slate-800"
                >
                  Choose plan
                </Link>
                <p className="mt-3 text-center text-sm text-slate-500">25 users — With access for 3 accountants</p>

                <div
                  className="my-6 h-px w-full bg-gradient-to-r from-cyan-400 via-[var(--brand-cyber)] to-sky-500"
                  aria-hidden
                />

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-sky-100 bg-sky-50/90 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Sparkles className="h-4 w-4 text-cyan-600" />
                          Accounting
                        </div>
                        <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
                      </div>
                      <ul className="mt-3 space-y-2.5 text-sm leading-snug text-slate-800">
                        <li className="flex gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                          Everything in Plus
                        </li>
                        <li className="flex gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                          <span className="flex flex-wrap items-center gap-2">
                            Guides setup and gives ongoing guidance
                            <span
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-300 text-[10px] font-semibold text-slate-700"
                              aria-hidden
                            >
                              PM
                            </span>
                            <span className="rounded bg-slate-200/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-600">
                              BETA
                            </span>
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                          Personalizes business intelligence metrics
                        </li>
                        <li className="flex gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                          Create custom KPIs, dashboards, and reports
                        </li>
                        <li className="flex gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                          Integrates project management with Project Management AI
                        </li>
                        <li className="flex gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                          Gives tailored financial insights with Finance AI
                        </li>
                        <li className="flex gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                          <span>
                            Chat for instant insights
                            <span className="mt-0.5 block text-xs italic text-slate-600">25 questions per month</span>
                          </span>
                        </li>
                      </ul>
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 transition hover:text-cyan-800"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Play demo
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-base font-semibold text-slate-900">Top features</p>
                      <ul className="mt-2 space-y-1.5 text-sm text-slate-800">
                        {[
                          "Everything in Plus",
                          "Customize user permissions and access",
                          "Automate workflows",
                          "Sync data from Excel",
                          "Forecast cash flow and profit",
                          "Send batch invoices and expenses",
                          "Backup and restore",
                          "Get priority support and training",
                        ].map((t) => (
                          <li key={t} className="flex gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-cyber)]" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Sparkles className="h-4 w-4 text-cyan-600" />
                        Accounting
                      </div>
                      <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-sm font-medium text-slate-900">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                      Personalizes business intelligence metrics
                    </p>
                    <p className="mb-1 mt-4 text-sm font-semibold text-slate-900">Top features</p>
                    <ul className="space-y-2.5 text-sm text-slate-700">
                      <li>
                        <span className="font-semibold text-slate-900">Multi-dimensional reporting</span> for high-level
                        and granular control
                      </li>
                      <li>
                        <span className="font-semibold text-slate-900">Integrated project and workflow management</span>{" "}
                        to delegate at scale
                      </li>
                      <li>
                        <span className="font-semibold text-slate-900">Advanced planning and analytics</span> to shape
                        strategic decision-making
                      </li>
                      <li>
                        <span className="font-semibold text-slate-900">Dedicated customer support manager</span> to
                        optimize your suite
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </article>

            <article className="overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
                <span className="font-bold text-[var(--brand-cyber)]">Enterprise</span>{" "}
                <span className="text-slate-900">Ministry</span>
              </h3>
              <p className="mt-2 text-base text-slate-600">
                Simplify your organization at scale with an ERP-level solution designed for operational sophistication
                across sites, funds, and finance teams.
              </p>
              <Link
                href="/command-center"
                className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-slate-950 px-3 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-slate-800"
              >
                Learn more
              </Link>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-cyan-700">
                <PlayCircle className="h-4 w-4" />
                See it in action (3:42) — product tour
              </p>

              <div className="mt-6 rounded-xl border border-sky-100 bg-sky-50/80 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Sparkles className="h-4 w-4 text-cyan-600" />
                    Accounting
                  </div>
                  <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-800">
                  {[
                    "Entity consolidation and intercompany eliminations",
                    "Role-based approval chains and segregation of duties",
                    "Policy-driven close calendar with attestations",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                      {t}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700"
                >
                  <PlayCircle className="h-4 w-4" />
                  Play demo
                </button>
              </div>
            </article>
          </div>
        )}

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs text-slate-500">
          * Placeholder plan presentation for UI demonstration. Connect pricing and entitlements in Supabase/Stripe in a
          later pass.
        </p>
      </div>
    </section>
  );
}
