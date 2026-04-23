/**
 * PARABLE bulk import — required headers and validation (guardrails for DataValidator).
 */

export type ImportKind = "members" | "journal" | "vendors";

export const MEMBER_CSV_HEADERS = [
  "member_external_id",
  "full_name",
  "email",
  "phone",
  "household_id",
  "role",
  "since_date",
] as const;

export const JOURNAL_CSV_HEADERS = [
  "transaction_id",
  "transaction_date",
  "amount",
  "memo",
  "parable_account_code",
  "fund_id",
  "import_batch_id",
  "source",
] as const;

export const VENDOR_CSV_HEADERS = [
  "vendor_id",
  "display_name",
  "remit_to_email",
  "default_expense_coa",
  "notes",
  "active",
] as const;

const REQUIRED: Record<ImportKind, string[]> = {
  members: ["email", "full_name"],
  journal: ["transaction_date", "amount", "parable_account_code", "fund_id"],
  vendors: ["vendor_id", "display_name"],
};

export function getExpectedHeaderList(kind: ImportKind): string[] {
  if (kind === "members") return [...MEMBER_CSV_HEADERS];
  if (kind === "journal") return [...JOURNAL_CSV_HEADERS];
  return [...VENDOR_CSV_HEADERS];
}

function normalizeHeader(h: string) {
  return h.replace(/^\uFEFF/, "").trim().toLowerCase();
}

/**
 * @returns { missing: string[], extraOk: boolean } — all REQUIRED present (order-independent).
 */
export function validateHeaderRow(headers: string[], kind: ImportKind) {
  const n = new Set(headers.map(normalizeHeader));
  const need = REQUIRED[kind];
  const missing = need.filter((h) => !n.has(normalizeHeader(h)));
  return { missing, ok: missing.length === 0, normalized: headers.map(normalizeHeader) };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function fieldErrorsForMemberRow(
  row: Record<string, string>,
  index: number,
  seenEmail: Set<string>,
): { row: number; field: string; message: string }[] {
  const out: { row: number; field: string; message: string }[] = [];
  const email = (row.email ?? "").trim();
  if (!email) {
    out.push({ row: index, field: "email", message: "Email required" });
  } else if (!EMAIL.test(email)) {
    out.push({ row: index, field: "email", message: "Invalid email" });
  } else {
    const k = email.toLowerCase();
    if (seenEmail.has(k)) {
      out.push({ row: index, field: "email", message: "Duplicate email in file" });
    } else {
      seenEmail.add(k);
    }
  }
  if (!(row.full_name ?? "").trim()) {
    out.push({ row: index, field: "full_name", message: "Full name required" });
  }
  return out;
}

export function fieldErrorsForJournalRow(
  row: Record<string, string>,
  index: number,
  seenTx: Set<string>,
): { row: number; field: string; message: string }[] {
  const out: { row: number; field: string; message: string }[] = [];
  const d = (row.transaction_date ?? "").trim();
  if (!d) out.push({ row: index, field: "transaction_date", message: "Date required" });
  const amt = Number((row.amount ?? "").replace(/,/g, "").trim());
  if (row.amount == null || row.amount === "" || Number.isNaN(amt)) {
    out.push({ row: index, field: "amount", message: "Amount must be numeric" });
  }
  const ac = (row.parable_account_code ?? "").trim();
  if (!ac) out.push({ row: index, field: "parable_account_code", message: "Account code required" });
  if (!(row.fund_id ?? "").trim()) out.push({ row: index, field: "fund_id", message: "Fund id required" });
  const tx = (row.transaction_id ?? "").trim();
  if (tx) {
    if (seenTx.has(tx)) {
      out.push({ row: index, field: "transaction_id", message: "Duplicate transaction_id" });
    } else {
      seenTx.add(tx);
    }
  }
  return out;
}

export function fieldErrorsForVendorRow(row: Record<string, string>, index: number, seen: Set<string>) {
  const out: { row: number; field: string; message: string }[] = [];
  const id = (row.vendor_id ?? "").trim();
  if (!id) out.push({ row: index, field: "vendor_id", message: "Vendor id required" });
  else {
    if (seen.has(id)) {
      out.push({ row: index, field: "vendor_id", message: "Duplicate vendor_id" });
    } else {
      seen.add(id);
    }
  }
  if (!(row.display_name ?? "").trim()) {
    out.push({ row: index, field: "display_name", message: "Display name required" });
  }
  return out;
}
