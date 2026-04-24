/**
 * UTC ranges for dashboard rollups (tithes, payroll, exports).
 */
export type MatrixTithePeriod = "mtd" | "full_month" | "qtd" | "ytd";

export function getTitheRange(period: MatrixTithePeriod, now = new Date()): { start: string; end: string; label: string } {
  const y = now.getUTCFullYear();
  const m0 = now.getUTCMonth();
  const endIso = (d: Date) => d.toISOString();
  if (period === "ytd") {
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    return { start: endIso(start), end: endIso(now), label: "Year to date" };
  }
  if (period === "qtd") {
    const q = Math.floor(m0 / 3) * 3;
    const start = new Date(Date.UTC(y, q, 1, 0, 0, 0, 0));
    return { start: endIso(start), end: endIso(now), label: "Quarter to date" };
  }
  if (period === "full_month") {
    const start = new Date(Date.UTC(y, m0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m0 + 1, 0, 23, 59, 59, 999));
    return { start: endIso(start), end: endIso(end), label: "Full calendar month" };
  }
  const start = new Date(Date.UTC(y, m0, 1, 0, 0, 0, 0));
  return { start: endIso(start), end: endIso(now), label: "Month to date" };
}

export type MatrixPayrollPeriod = "month" | "qtd" | "ytd";

export function getPayrollRange(period: MatrixPayrollPeriod, now = new Date()): { start: string; end: string; label: string } {
  const y = now.getUTCFullYear();
  const m0 = now.getUTCMonth();
  if (period === "ytd") {
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10), label: "YTD" };
  }
  if (period === "qtd") {
    const q = Math.floor(m0 / 3) * 3;
    const start = new Date(Date.UTC(y, q, 1, 0, 0, 0, 0));
    return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10), label: "QTD" };
  }
  const start = new Date(Date.UTC(y, m0, 1, 0, 0, 0, 0));
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10), label: "This month" };
}

export function monthUtcBounds(year: number, month1to12: number) {
  const s = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
  const e = new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
  return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
}
