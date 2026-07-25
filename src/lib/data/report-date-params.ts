import { getYearToDateRange } from "./query-helpers";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ReportDateParams = {
  asOfDate: string;
  periodStartDate: string;
  periodEndDate: string;
};

export type OpenAccountingPeriodBounds = {
  startDate: string;
  endDate: string;
};

export function isIsoDateString(value: string | undefined | null): value is string {
  if (!value || !ISO_DATE.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function minDate(left: string, right: string): string {
  return left <= right ? left : right;
}

/**
 * Resolve report as-of / income-statement period bounds from optional query input.
 *
 * Defaults:
 * - as-of → today
 * - period → current open accounting period through as-of, else calendar YTD
 */
export function resolveReportDateParams(
  input: {
    asOf?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
  },
  options?: {
    openPeriod?: OpenAccountingPeriodBounds | null;
  },
): ReportDateParams {
  const asOfDate = isIsoDateString(input.asOf) ? input.asOf : getTodayDateString();
  const ytd = getYearToDateRange(new Date(`${asOfDate}T12:00:00.000Z`));
  const openPeriod = options?.openPeriod ?? null;

  const defaultPeriodStart =
    openPeriod && isIsoDateString(openPeriod.startDate)
      ? openPeriod.startDate
      : ytd.startDate;
  const defaultPeriodEnd =
    openPeriod && isIsoDateString(openPeriod.endDate)
      ? minDate(asOfDate, openPeriod.endDate)
      : asOfDate;

  let periodEndDate = isIsoDateString(input.periodEnd)
    ? input.periodEnd
    : defaultPeriodEnd;
  if (periodEndDate > asOfDate) {
    periodEndDate = asOfDate;
  }

  let periodStartDate = isIsoDateString(input.periodStart)
    ? input.periodStart
    : defaultPeriodStart;
  if (periodStartDate > periodEndDate) {
    periodStartDate = periodEndDate;
  }

  return {
    asOfDate,
    periodStartDate,
    periodEndDate,
  };
}
