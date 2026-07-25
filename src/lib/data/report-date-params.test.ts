import { afterEach, describe, expect, it, vi } from "vitest";

import { isIsoDateString, resolveReportDateParams } from "./report-date-params";

describe("report-date-params", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts valid ISO dates only", () => {
    expect(isIsoDateString("2026-07-24")).toBe(true);
    expect(isIsoDateString("2026-13-01")).toBe(false);
    expect(isIsoDateString("07/24/2026")).toBe(false);
    expect(isIsoDateString("")).toBe(false);
  });

  it("defaults to today and YTD through as-of", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T15:00:00.000Z"));

    expect(resolveReportDateParams({})).toEqual({
      asOfDate: "2026-07-24",
      periodStartDate: "2026-01-01",
      periodEndDate: "2026-07-24",
    });
  });

  it("honors valid query dates and clamps period end to as-of", () => {
    expect(
      resolveReportDateParams({
        asOf: "2026-06-30",
        periodStart: "2026-04-01",
        periodEnd: "2026-12-31",
      }),
    ).toEqual({
      asOfDate: "2026-06-30",
      periodStartDate: "2026-04-01",
      periodEndDate: "2026-06-30",
    });
  });

  it("ignores invalid dates and clamps start after end", () => {
    expect(
      resolveReportDateParams({
        asOf: "not-a-date",
        periodStart: "2026-08-01",
        periodEnd: "2026-07-15",
      }),
    ).toMatchObject({
      periodStartDate: "2026-07-15",
      periodEndDate: "2026-07-15",
    });
  });
});
