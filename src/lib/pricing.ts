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
};

export const PLAN_SELECTION_STORAGE_KEY = "parable_selected_plan";

export const PLAN_PRICING: PlanPricing[] = [
  { id: "simple_start", name: "Simple Start", monthlyPrice: 19, discountLabel: "50% off for 3 months*" },
  { id: "essentials", name: "Essentials", monthlyPrice: 37.5, discountLabel: "50% off for 3 months*" },
  { id: "plus", name: "Plus", monthlyPrice: 57.5, discountLabel: "50% off for 3 months*" },
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

export function saveSelectedPlan(selection: SelectedPlanSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PLAN_SELECTION_STORAGE_KEY, JSON.stringify(selection));
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

