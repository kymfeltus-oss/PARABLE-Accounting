import Link from "next/link";
import { Check, ChevronUp, PlayCircle, Sparkles } from "lucide-react";

type CtaStyle = "primary" | "dark";

type IntelLine = { type: "beta"; text: string } | { type: "text"; text: string };

const PLANS: {
  name: string;
  price: string;
  compareAt?: string;
  users: string;
  accountants: string;
  cta: CtaStyle;
  intel: IntelLine[];
  hasChat: boolean;
  topFeatures: string[];
}[] = [
  {
    name: "Simple Start",
    price: "$19",
    users: "1 user",
    accountants: "With access for 2 accountants",
    cta: "primary",
    hasChat: true,
    intel: [
      { type: "beta", text: "Guides you through setup and onboarding" },
      { type: "text", text: "Categorizes expenses" },
      { type: "text", text: "Maximizes tax deductions" },
    ],
    topFeatures: [
      "Automated bookkeeping",
      "Run basic business reports",
      "Invoice and get paid",
      "Automate and pay bills",
      "Includes 5 ACH payments/month",
    ],
  },
  {
    name: "Essentials",
    price: "$37.50",
    users: "3 users",
    accountants: "With access for 2 accountants",
    cta: "primary",
    hasChat: true,
    intel: [
      { type: "text", text: "Everything in Simple Start" },
      { type: "text", text: "Cleans up your books, fast with Accounting AI" },
      { type: "text", text: "Gets you paid faster with Payments AI" },
    ],
    topFeatures: [
      "Everything in Simple Start",
      "Run enhanced reports",
      "Get customer referrals, feedback, work requests, and testimonials",
      "Add employee time to invoices",
      "Appointment scheduling",
    ],
  },
  {
    name: "Plus",
    price: "$57.50",
    users: "5 users",
    accountants: "With access for 2 accountants",
    cta: "primary",
    hasChat: true,
    intel: [
      { type: "text", text: "Everything in Essentials" },
      { type: "text", text: "Reconciles your books" },
      { type: "text", text: "Surfaces profit & loss insights" },
      { type: "text", text: "Finds and fixes errors" },
      { type: "text", text: "Automates sales taxes with Sales Tax AI" },
      { type: "text", text: "Sources leads, helps follow up with Customer AI" },
    ],
    topFeatures: [
      "Everything in Essentials",
      "Run comprehensive reports",
      "Plan budgets",
      "Automatically track project profitability",
      "Track classes and locations",
    ],
  },
  {
    name: "Advanced",
    price: "$137.50",
    compareAt: "$275",
    users: "25 users",
    accountants: "With access for 3 accountants",
    cta: "dark",
    hasChat: true,
    intel: [
      { type: "text", text: "Everything in Plus" },
      { type: "text", text: "Personalizes business intelligence metrics" },
      { type: "text", text: "Create custom KPIs, dashboards, and reports" },
      { type: "text", text: "Integrates project management with Project Management AI" },
      { type: "text", text: "Gives tailored financial insights with Finance AI" },
    ],
    topFeatures: [
      "Everything in Plus",
      "Customize user permissions and access",
      "Automate workflows",
      "Sync data from Excel",
      "Forecast cash flow and profit",
      "Send batch invoices and expenses",
      "Backup and restore",
      "Get priority support and training",
    ],
  },
];

const ctaPrimary =
  "mt-3 inline-flex w-full items-center justify-center rounded py-2.5 text-sm font-bold uppercase tracking-wide text-slate-950 transition hover:brightness-110 [background-color:var(--brand-cyber)]";

const ctaDark =
  "mt-3 inline-flex w-full items-center justify-center rounded bg-slate-950 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-slate-800";

export default function SmallBusinessPlanColumns() {
  return (
    <div className="mx-auto mt-8 max-w-7xl">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm"
          >
            <div className="p-3 sm:p-4">
              <h3 className="text-sm font-bold tracking-tight sm:text-base">{plan.name}</h3>
              <p className="mt-1 text-xs text-slate-800 sm:text-sm">Save 50% for 3 months*</p>
              {plan.compareAt && (
                <p className="mt-1 flex items-end gap-2">
                  <span className="text-sm text-slate-400 line-through">{plan.compareAt}</span>
                  <span className="text-2xl font-bold sm:text-3xl">
                    {plan.price}
                    <span className="text-sm font-medium text-slate-600">/mo</span>
                  </span>
                </p>
              )}
              {!plan.compareAt && (
                <p className="mt-1 text-2xl font-bold sm:text-3xl">
                  {plan.price}
                  <span className="text-sm font-medium text-slate-600">/mo</span>
                </p>
              )}

              <Link
                href="/register"
                className={plan.cta === "primary" ? ctaPrimary : ctaDark}
                aria-label={`Choose ${plan.name} plan`}
              >
                Choose plan
              </Link>
              <p className="mt-3 text-sm font-bold sm:text-base">{plan.users}</p>
              <p className="text-xs text-slate-600 sm:text-sm">{plan.accountants}</p>
            </div>

            <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500 via-indigo-400 to-violet-500" aria-hidden />

            <div className="flex-1 border-t border-slate-200 bg-slate-100/80 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-1 text-xs font-semibold sm:text-sm">
                <div className="flex min-w-0 items-center gap-1.5 text-slate-900">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-600 sm:h-4 sm:w-4" />
                  <span>Guided Intelligence</span>
                </div>
                <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
              </div>
              <ul className="mt-2.5 space-y-2.5 text-xs leading-snug text-slate-800 sm:text-sm">
                {plan.intel.map((line) =>
                  line.type === "beta" ? (
                    <li key="beta" className="flex flex-col gap-1">
                      <div className="flex gap-2">
                        <span
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-300 text-[10px] font-semibold text-slate-700"
                          aria-hidden
                        >
                          PM
                        </span>
                        <div className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            {line.text}
                            <span className="rounded bg-slate-200/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                              BETA
                            </span>
                          </span>
                        </div>
                      </div>
                    </li>
                  ) : (
                    <li key={line.text} className="flex gap-2">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600 sm:h-4 sm:w-4" />
                      <span>{line.text}</span>
                    </li>
                  ),
                )}
                {plan.hasChat && (
                  <li className="flex gap-2">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600 sm:h-4 sm:w-4" />
                    <span>
                      Chat for instant insights
                      <span className="mt-0.5 block text-xs italic text-slate-600">25 questions per month</span>
                    </span>
                  </li>
                )}
              </ul>
              <button
                type="button"
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 transition hover:text-cyan-800 sm:text-sm"
              >
                <PlayCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Play demo
              </button>
            </div>

            <div className="bg-white p-3 sm:p-4">
              <p className="text-sm font-bold sm:text-base">Top features</p>
              <ul className="mt-2 space-y-1.5 text-xs sm:text-sm">
                {plan.topFeatures.map((t) => (
                  <li key={t} className="flex gap-2 text-slate-800">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-cyber)] sm:h-4 sm:w-4" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
