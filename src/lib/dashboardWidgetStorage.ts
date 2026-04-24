import type { MatrixPayrollPeriod, MatrixTithePeriod } from "./dashboardDateRanges";

export const DASHBOARD_MATRIX_KEY = "parable:dashboardMatrix:v1";

export type WidgetId = "tithes" | "payroll" | "alerts";

export const DEFAULT_WIDGET_ORDER: WidgetId[] = ["tithes", "payroll", "alerts"];

export type DashboardMatrixConfig = {
  version: 1;
  order: WidgetId[];
  enabled: Record<WidgetId, boolean>;
  tithePeriod: MatrixTithePeriod;
  payrollPeriod: MatrixPayrollPeriod;
};

const defaultConfig: DashboardMatrixConfig = {
  version: 1,
  order: [...DEFAULT_WIDGET_ORDER],
  enabled: { tithes: true, payroll: true, alerts: true },
  tithePeriod: "mtd",
  payrollPeriod: "month",
};

function parse(raw: string | null): DashboardMatrixConfig {
  if (!raw) return { ...defaultConfig, order: [...defaultConfig.order] };
  try {
    const p = JSON.parse(raw) as Partial<DashboardMatrixConfig>;
    if (p.version !== 1) return { ...defaultConfig, order: [...defaultConfig.order] };
    const order = (p.order as WidgetId[] | undefined)?.filter((x) => isWidgetId(x)) ?? [...DEFAULT_WIDGET_ORDER];
    const seen = new Set<WidgetId>();
    const unique = order.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
    for (const w of DEFAULT_WIDGET_ORDER) {
      if (!unique.includes(w)) unique.push(w);
    }
    return {
      version: 1,
      order: unique,
      enabled: {
        tithes: p.enabled?.tithes !== false,
        payroll: p.enabled?.payroll !== false,
        alerts: p.enabled?.alerts !== false,
      },
      tithePeriod: p.tithePeriod && ["mtd", "full_month", "qtd", "ytd"].includes(p.tithePeriod) ? p.tithePeriod : "mtd",
      payrollPeriod: p.payrollPeriod && ["month", "qtd", "ytd"].includes(p.payrollPeriod) ? p.payrollPeriod : "month",
    };
  } catch {
    return { ...defaultConfig, order: [...defaultConfig.order] };
  }
}

function isWidgetId(s: string): s is WidgetId {
  return s === "tithes" || s === "payroll" || s === "alerts";
}

export function loadDashboardMatrixConfig(): DashboardMatrixConfig {
  if (typeof window === "undefined") return { ...defaultConfig, order: [...defaultConfig.order] };
  return parse(localStorage.getItem(DASHBOARD_MATRIX_KEY));
}

export function saveDashboardMatrixConfig(c: DashboardMatrixConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DASHBOARD_MATRIX_KEY, JSON.stringify(c));
}
