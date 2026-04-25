/** Local calendar date + `days` (e.g. trial end shown to the user as “today + 30”). */
export function addLocalCalendarDays(ref: Date, days: number): Date {
  const d = new Date(ref.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDateLongLocal(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Local calendar `YYYY-MM-DD` (for metadata aligned with the user-facing trial end date). */
export function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
