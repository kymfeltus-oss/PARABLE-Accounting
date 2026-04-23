/**
 * Quarter-end and Form 941 “window” hints for the EOQ Status Room.
 * 941 (monthly schedule) is often due last day of month *after* quarter; use for UI only.
 */

/**
 * @returns 1-4
 */
export function getCalendarQuarterFromDate(d: Date): 1 | 2 | 3 | 4 {
  const m = d.getMonth();
  if (m < 3) return 1;
  if (m < 6) return 2;
  if (m < 9) return 3;
  return 4;
}

/**
 * last day of (calendar) quarter: Mar 31, Jun 30, Sep 30, Dec 31
 */
export function getQuarterEndDate(year: number, quarter: 1 | 2 | 3 | 4): Date {
  const month = quarter * 3; // 3,6,9,12
  return new Date(year, month, 0, 23, 59, 59, 999);
}

/**
 * Form 941 monthly-depositor due (simplified: last day of the month *after* quarter, not business-day adjusted).
 * Q1 → Apr 30, Q2 → Jul 31, Q3 → Oct 31, Q4 → Jan 31 (next year)
 */
export function getForm941DueDate(year: number, quarter: 1 | 2 | 3 | 4): Date {
  if (quarter === 1) return new Date(year, 3, 30, 23, 59, 59, 999);
  if (quarter === 2) return new Date(year, 6, 31, 23, 59, 59, 999);
  if (quarter === 3) return new Date(year, 9, 31, 23, 59, 59, 999);
  return new Date(year + 1, 0, 31, 23, 59, 59, 999);
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * @returns { days: number, nearQuarterEnd: boolean } if within 15 days *before* or *at* a quarter end (EOQ “alert window”)
 */
export function getEoqComplianceWindow(
  now = new Date(),
  windowDays = 15,
): { active: boolean; daysToQuarterEnd: number | null; year: number; quarter: 1 | 2 | 3 | 4; quarterEnd: Date } {
  const y = now.getFullYear();
  const testQuarters: Array<{ q: 1 | 2 | 3 | 4; end: Date }> = [
    { q: 1, end: getQuarterEndDate(y, 1) },
    { q: 2, end: getQuarterEndDate(y, 2) },
    { q: 3, end: getQuarterEndDate(y, 3) },
    { q: 4, end: getQuarterEndDate(y, 4) },
  ];

  const today = startOfLocalDay(now);
  for (const { q, end } of testQuarters) {
    const endDay = startOfLocalDay(end);
    const diffMs = endDay.getTime() - today.getTime();
    const days = Math.round(diffMs / 86400000);
    if (days >= 0 && days <= windowDays) {
      return { active: true, daysToQuarterEnd: days, year: y, quarter: q, quarterEnd: end };
    }
  }
  return { active: false, daysToQuarterEnd: null, year: y, quarter: getCalendarQuarterFromDate(now), quarterEnd: getQuarterEndDate(y, getCalendarQuarterFromDate(now)) };
}

/**
 * Which *completed* tax quarter the EOQ page should show by default: after Q ends, the “current filing” is prior quarter
 * through the due month. For minimal UX: in alert window, highlight the quarter *ending* soon.
 */
export function suggestedReportQuarter(
  now = new Date(),
): { year: number; quarter: 1 | 2 | 3 | 4; dueDate: Date; dueLabel: string } {
  const w = getEoqComplianceWindow(now, 15);
  if (w.active && w.daysToQuarterEnd !== null) {
    return {
      year: w.year,
      quarter: w.quarter,
      dueDate: getForm941DueDate(w.year, w.quarter),
      dueLabel: getForm941DueDate(w.year, w.quarter).toLocaleDateString(undefined, { dateStyle: "long" }),
    };
  }
  const q = getCalendarQuarterFromDate(now);
  return {
    year: now.getFullYear(),
    quarter: q,
    dueDate: getForm941DueDate(now.getFullYear(), q),
    dueLabel: getForm941DueDate(now.getFullYear(), q).toLocaleDateString(undefined, { dateStyle: "long" }),
  };
}
