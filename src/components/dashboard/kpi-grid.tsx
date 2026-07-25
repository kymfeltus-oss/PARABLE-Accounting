import {
  Heart,
  Landmark,
  PieChart,
  WalletCards,
} from "lucide-react";

import { formatCurrency } from "@/features/accounting-dashboard/lib/formatters";
import type {
  DashboardKpi,
  KpiAccent,
} from "@/features/accounting-dashboard/types/dashboard";

const accentClasses: Record<KpiAccent, { icon: string }> = {
  blue: {
    icon: "border-[#1677FF] text-[#1677FF]",
  },
  cyan: {
    icon: "border-[#13C6FF] text-[#13C6FF]",
  },
  amber: {
    icon: "border-[#FFB547] text-[#FFB547]",
  },
  violet: {
    icon: "border-[#8B5CF6] text-[#A56EFF]",
  },
};

const icons = {
  cash: Landmark,
  giving: Heart,
  expenses: PieChart,
  funds: WalletCards,
};

export function KpiGrid({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <section
      aria-label="Financial overview metrics"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {kpis.map((kpi) => {
        const Icon = icons[kpi.id as keyof typeof icons] ?? Landmark;
        const colors = accentClasses[kpi.accent];

        return (
          <article
            key={kpi.id}
            className="dashboard-command-card min-h-[8.5rem] overflow-hidden px-4 py-4"
          >
            <div className="flex items-start gap-4">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-full border bg-black/10 ${colors.icon}`}
              >
                <Icon aria-hidden className="size-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="brand-label truncate text-[#AEB9CE]">
                  {kpi.label}
                </p>
                <p className="mt-2 min-w-0 truncate font-heading text-[clamp(1.2rem,4vw,1.7rem)] font-medium tracking-[-0.035em] text-[#F7FAFF] tabular-nums">
                  {kpi.value === null
                    ? "Unavailable"
                    : formatCurrency(kpi.value)}
                </p>
                <p className="mt-1 min-h-5 truncate text-[0.68rem] text-[#AEB9CE]">
                  {kpi.supportingText}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
