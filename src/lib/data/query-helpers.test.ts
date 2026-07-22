import { describe, expect, it } from "vitest";

import { DataAccessError } from "./data-access-error";
import {
  sumAmounts,
  unwrapCount,
  unwrapRows,
} from "./query-helpers";
import { createBackendError } from "./test/mock-supabase-client";

describe("query helpers", () => {
  it("unwrapRows returns an empty array when data is null", () => {
    expect(unwrapRows("test", { data: null, error: null })).toEqual([]);
  });

  it("unwrapCount returns zero when count is null", () => {
    expect(unwrapCount("test", { count: null, error: null })).toBe(0);
  });

  it("unwrapRows throws DataAccessError for backend errors", () => {
    expect(() =>
      unwrapRows("test", {
        data: null,
        error: createBackendError("query failed"),
      }),
    ).toThrow(DataAccessError);
  });

  it("sumAmounts totals numeric and string amounts", () => {
    expect(sumAmounts([{ amount: 10 }, { amount: "15.50" }])).toBe(25.5);
  });
});
