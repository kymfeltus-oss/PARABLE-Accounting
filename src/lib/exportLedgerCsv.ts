/** Minimal GL-style export for Audit Mode (extend with real journal lines later). */
export function buildGeneralLedgerCsvPlaceholder(): string {
  const header = "date,account,fund,memo,debit,credit";
  const rows = [
    `${new Date().toISOString().slice(0, 10)},4100-000,GENERAL,Opening / placeholder,0.00,0.00`,
  ];
  return [header, ...rows].join("\n");
}

/** Audit Mode — header block suitable for counsel / board packet merge. */
export function buildCertifiedLedgerCsv(): string {
  const stamp = new Date().toISOString();
  const preamble = [
    `"PARABLE Accounting — certified ledger extract (placeholder rows)"`,
    `"Generated UTC","${stamp}"`,
    "",
  ].join("\n");
  return preamble + buildGeneralLedgerCsvPlaceholder();
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
