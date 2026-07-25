import { getYearToDateRange } from "./query-helpers";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ReportDateParams = {
  asOfDate: string;
  periodStartDate: string;
  periodEndDate: string;
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

/**
 * Resolve report as-of / income-statement period bounds from optional query input.
 * Invalid values fall back to today and calendar YTD through as-of.
 */
export function resolveReportDateParams(input: {
  asOf?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}): ReportDateParams {
  const asOfDate = isIsoDateString(input.asOf) ? input.asOf : getTodayDateString();
  const ytd = getYearToDateRange(new Date(`${asOfDate}T12:00:00.000Z`));

  let periodEndDate = isIsoDateString(input.periodEnd) ? input.periodEnd : asOfDate;
  if (periodEndDate > asOfDate) {
    periodEndDate = asOfDate;
  }

  let periodStartDate = isIsoDateString(input.periodStart)
    ? input.periodStart
    : ytd.startDate;
  if (periodStartDate > periodEndDate) {
    periodStartDate = periodEndDate;
  }

  return {
    asOfDate,
    periodStartDate,
    periodEndDate,
  };
}
