"use client";

export type PlanId = "simple_start" | "essentials" | "plus" | "advanced";

export type PlanPricing = {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  compareAtMonthlyPrice?: number;
  discountLabel?: string;
};

export type SelectedPlanSession = {
  planId: PlanId;
  planName: string;
  monthlyPrice: number;
  discountLabel?: string;
  /** When true (default), checkout shows $0 due today for the 30-day trial path. */
  freeTrial30Day?: boolean;
};

export const PLAN_SELECTION_STORAGE_KEY = "parable_selected_plan";

export const PLAN_PRICING: PlanPricing[] = [
  { id: "simple_start", name: "Simple Start", monthlyPrice: 19, compareAtMonthlyPrice: 38, discountLabel: "50% off for 3 months*" },
  { id: "essentials", name: "Essentials", monthlyPrice: 37.5, compareAtMonthlyPrice: 75, discountLabel: "50% off for 3 months*" },
  { id: "plus", name: "Plus", monthlyPrice: 57.5, compareAtMonthlyPrice: 115, discountLabel: "50% off for 3 months*" },
  {
    id: "advanced",
    name: "Advanced",
    monthlyPrice: 137.5,
    compareAtMonthlyPrice: 275,
    discountLabel: "50% off for 3 months*",
  },
];

export const ADD_ONS = {
  /** PARABLE Giving monthly add-on (shown at registration / checkout). */
  givingMonthly: 20,
} as const;

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function parseCurrencyValue(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const val = Number.parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

export function findPlanByName(name: string): PlanPricing | undefined {
  return PLAN_PRICING.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
}

export function getPlanById(id: PlanId): PlanPricing | undefined {
  return PLAN_PRICING.find((p) => p.id === id);
}

/** Standard monthly plan price after the 3-month 50% intro period (catalog `compareAtMonthlyPrice`). */
export function getStandardMonthlyPlanPrice(plan: PlanPricing): number {
  if (typeof plan.compareAtMonthlyPrice === "number") return plan.compareAtMonthlyPrice;
  return plan.monthlyPrice;
}

export function saveSelectedPlan(selection: SelectedPlanSession): void {
  if (typeof window === "undefined") return;
  const prev = loadSelectedPlan();
  const merged: SelectedPlanSession = {
    planId: selection.planId,
    planName: selection.planName,
    monthlyPrice: selection.monthlyPrice,
    discountLabel: selection.discountLabel ?? prev?.discountLabel,
    freeTrial30Day:
      selection.freeTrial30Day !== undefined ? selection.freeTrial30Day : (prev?.freeTrial30Day ?? true),
  };
  window.sessionStorage.setItem(PLAN_SELECTION_STORAGE_KEY, JSON.stringify(merged));
}

export function loadSelectedPlan(): SelectedPlanSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PLAN_SELECTION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SelectedPlanSession;
    if (!parsed?.planId || !parsed?.planName) return null;
    return parsed;
  } catch {
    return null;
  }
}

