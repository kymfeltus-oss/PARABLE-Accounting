"use client";

import JSZip from "jszip";
import {
  buildCertifiedLedgerCsv,
  buildGeneralLedgerCsvPlaceholder,
  downloadTextFile,
} from "@/lib/exportLedgerCsv";

export function buildTrialBalanceCsvPlaceholder(): string {
  const h = "account_code,account_name,fund_id,debit,credit,net";
  return [h, "4100,General fund — tithes,GEN,0,12000,12000", "5010,Staff salary,GEN,45000,0,-45000"].join("\n");
}

export function buildIncomeStatementCsvPlaceholder(): string {
  const h = "line,description,current_period_ytd";
  return [h, "Revenue,Tithes & offerings,120000", "Expense,Ministry programs,45000", "Net,Excess,75000"].join("\n");
}

export function buildMemberCrmExportPlaceholder(): string {
  return [
    "member_id,full_name,email,household_id,giving_id,first_gift_date,active",
    "m1,Sample Member,example@church.org,h1,giv_8f2a,2024-01-01,1",
  ].join("\n");
}

export function buildSovereignVaultIndexPlaceholder(): string {
  return [
    "path,document_type,retention,uploaded_utc,checksum_sha256",
    "legal/501c3-determination.pdf,corporate,permanent,2024-03-01,—",
  ].join("\n");
}

export async function downloadCfoExitZipBundle() {
  const z = new JSZip();
  const f = (path: string, c: string) => z.file(path, c);
  f("01_ledger/ledger.csv", buildCertifiedLedgerCsv());
  f("01_ledger/general_ledger_lines.csv", buildGeneralLedgerCsvPlaceholder());
  f("02_financials/trial_balance.csv", buildTrialBalanceCsvPlaceholder());
  f("02_financials/income_statement.csv", buildIncomeStatementCsvPlaceholder());
  f("03_people/members_and_giving_ids.csv", buildMemberCrmExportPlaceholder());
  f("04_vault/vault_index.csv", buildSovereignVaultIndexPlaceholder());
  f("README.txt", "PARABLE CFO exit bundle (placeholder). Replace with live GL / CRM / vault queries.");
  const blob = await z.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `parable-audit-package-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export { downloadTextFile, buildCertifiedLedgerCsv, buildGeneralLedgerCsvPlaceholder };
