/**
 * General Liability: block month-end seal if a tracked policy row exists and is past expiration.
 * No GL row = OK (churches may store coverage elsewhere). Expired on-file = not OK.
 */

export type VaultCategory =
  | "GOVERNANCE"
  | "IRS_TAX"
  | "INSURANCE"
  | "FINANCIALS"
  | "CONTINUITY"
  | "RISK"
  | "LEGAL"
  | "OTHER";

export type VaultRow = {
  category: string;
  subcategory: string | null;
  expiration_date: string | null;
};

const GL = "GENERAL_LIABILITY";

function isGlRow(r: VaultRow) {
  if (r.category !== "INSURANCE") return false;
  const s = (r.subcategory || "").toUpperCase().replace(/\s/g, "_");
  return s === GL || s === "GENERAL LIABILITY";
}

/**
 * @returns true when seal may proceed; false = expired GL on file
 */
export function isGeneralLiabilityCurrentForSeal(rows: VaultRow[], today = new Date()): boolean {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (const r of rows) {
    if (!isGlRow(r) || !r.expiration_date) continue;
    const exp = new Date(r.expiration_date);
    if (Number.isNaN(exp.getTime())) continue;
    const d = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
    if (d < t) return false;
  }
  return true;
}

export type ExpiryUrgency = "ok" | "soon" | "expired" | "none";

export function documentExpiryUrgency(expirationDate: string | null, today = new Date()): ExpiryUrgency {
  if (!expirationDate) return "none";
  const exp = new Date(expirationDate);
  if (Number.isNaN(exp.getTime())) return "none";
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  if (d < t0) return "expired";
  const days = (d.getTime() - t0.getTime()) / (24 * 60 * 60 * 1000);
  if (days <= 30) return "soon";
  return "ok";
}
