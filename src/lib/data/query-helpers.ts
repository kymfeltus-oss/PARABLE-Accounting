import type { PostgrestError } from "@supabase/supabase-js";

import { DataAccessError } from "./data-access-error";

export function toDataAccessError(
  operation: string,
  error: PostgrestError,
): DataAccessError {
  return new DataAccessError({
    operation,
    message: error.message,
    cause: error,
  });
}

export function unwrapRows<T>(
  operation: string,
  result: { data: T[] | null; error: PostgrestError | null },
): T[] {
  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  return result.data ?? [];
}

export function unwrapCount(
  operation: string,
  result: { count: number | null; error: PostgrestError | null },
): number {
  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  return result.count ?? 0;
}

export function sumAmounts(
  rows: ReadonlyArray<{ amount: number | string }>,
): number {
  return rows.reduce((total, row) => total + Number(row.amount), 0);
}

export function getMonthDateRange(referenceDate = new Date()): {
  startDate: string;
  endDate: string;
} {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const startDate = new Date(Date.UTC(year, month, 1))
    .toISOString()
    .slice(0, 10);
  const endDate = new Date(Date.UTC(year, month + 1, 0))
    .toISOString()
    .slice(0, 10);

  return { startDate, endDate };
}

export function getYearToDateRange(referenceDate = new Date()): {
  startDate: string;
  endDate: string;
} {
  const year = referenceDate.getUTCFullYear();
  const startDate = new Date(Date.UTC(year, 0, 1)).toISOString().slice(0, 10);
  const endDate = referenceDate.toISOString().slice(0, 10);

  return { startDate, endDate };
}
