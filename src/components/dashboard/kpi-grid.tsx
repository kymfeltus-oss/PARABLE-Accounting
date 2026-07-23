import {
  Heart,
  Landmark,
  MoreHorizontal,
  PieChart,
  WalletCards,
} from "lucide-react";

import { formatCurrency } from "@/features/accounting-dashboard/lib/formatters";
import type {
  DashboardKpi,
  KpiAccent,
} from "@/features/accounting-dashboard/types/dashboard";

const accentClasses: Record<
  KpiAccent,
  { icon: string; line: string; fill: string }
> = {
  blue: {
    icon: "border-[#1677FF] text-[#1677FF]",
    line: "#1677FF",
    fill: "rgba(22,119,255,.16)",
  },
  cyan: {
    icon: "border-[#13C6FF] text-[#13C6FF]",
    line: "#13C6FF",
    fill: "rgba(19,198,255,.14)",
  },
  amber: {
    icon: "border-[#FFB547] text-[#FFB547]",
    line: "#FF9F0A",
    fill: "rgba(255,159,10,.14)",
  },
  violet: {
    icon: "border-[#8B5CF6] text-[#A56EFF]",
    line: "#9758FF",
    fill: "rgba(151,88,255,.15)",
  },
};

const icons = {
  cash: Landmark,
  giving: Heart,
  expenses: PieChart,
  funds: WalletCards,
};

const decorativePoints: Record<KpiAccent, number[]> = {
  blue: [28, 34, 42, 36, 48, 58, 41, 52, 61, 57, 70, 77, 82, 68, 80, 94, 101, 104, 115],
  cyan: [22, 24, 38, 35, 52, 47, 65, 59, 55, 68, 77, 61, 70, 65, 61, 74, 85, 96, 111],
  amber: [19, 25, 31, 45, 38, 32, 48, 39, 35, 47, 52, 48, 58, 65, 73, 79, 86, 93],
  violet: [16, 24, 34, 41, 59, 45, 33, 44, 53, 59, 62, 57, 66, 72, 78, 83, 90, 96],
};

function Sparkline({ kpi }: { kpi: DashboardKpi }) {
  const values =
    kpi.points && kpi.points.length > 1
      ? kpi.points
      : decorativePoints[kpi.accent];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const points = values
    .map(
      (point, index) =>
        `${(index / (values.length - 1)) * 100},${36 - ((point - min) / span) * 30}`,
    )
    .join(" ");
  const colors = accentClasses[kpi.accent];

  return (
    <svg
      aria-hidden="true"
      className="h-11 w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 100 40"
    >
      <defs>
        <linearGradient
          id={`fill-${kpi.id}`}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0" stopColor={colors.fill} />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#fill-${kpi.id})`}
        points={`0,40 ${points} 100,40`}
      />
      <polyline
        fill="none"
        points={points}
        stroke={colors.line}
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
      {values.map((point, index) => (
        <circle
          key={`${kpi.id}-${index}`}
          cx={(index / (values.length - 1)) * 100}
          cy={36 - ((point - min) / span) * 30}
          fill={colors.line}
          r="1"
        />
      ))}
    </svg>
  );
}

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
            className="dashboard-command-card min-h-[12rem] overflow-hidden px-4 pt-4"
          >
            <button
              type="button"
              aria-label={`${kpi.label} options`}
              className="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-md text-[#AEB9CE] hover:bg-white/[0.04] hover:text-[#F7FAFF]"
            >
              <MoreHorizontal aria-hidden className="size-5" />
            </button>
            <div className="flex items-start gap-4 pr-7">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-full border bg-black/10 ${colors.icon}`}
              >
                <Icon aria-hidden className="size-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="brand-label truncate text-[#AEB9CE]">
                  {kpi.label}
                </p>
                <p className="mt-2 whitespace-nowrap font-heading text-[1.7rem] font-medium tracking-[-0.035em] text-[#F7FAFF] tabular-nums">
                  {kpi.value === null
                    ? "Unavailable"
                    : formatCurrency(kpi.value)}
                </p>
                <div className="mt-1 flex min-h-5 items-center justify-between gap-2 text-[0.68rem]">
                  <span className="truncate text-[#AEB9CE]">
                    {kpi.supportingText}
                  </span>
                  {kpi.trend ? (
                    <span
                      className={
                        kpi.accent === "cyan"
                          ? "text-[#39D98A]"
                          : "text-[#13C6FF]"
                      }
                    >
                      ↑ {kpi.trend.label}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-2 pl-1">
              <Sparkline kpi={kpi} />
            </div>
          </article>
        );
      })}
    </section>
  );
}
