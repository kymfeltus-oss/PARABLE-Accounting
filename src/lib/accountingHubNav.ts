import { FOUNDRY_CFO_HOVER, type FoundrySubMenu } from "./sidebarFoundryNav";

const hover = (name: string) => FOUNDRY_CFO_HOVER[name] ?? "";

/** Center-screen Accounting dashboard: drill down from the left-rail “Accounting” link. */
export const ACCOUNTING_HUB_LINKS: FoundrySubMenu[] = [
  { name: "Accounts Payable", path: "/accounting/ap", icon: "document", function: hover("Accounts Payable") },
  { name: "Accounts Receivables", path: "/accounting/ar", icon: "bank", function: hover("Accounts Receivables") },
  { name: "General Ledger", path: "/accounting/gl", icon: "grid", function: hover("General Ledger") },
  { name: "Taxes", path: "/accounting/taxes", icon: "fileTax", function: hover("Taxes") },
  { name: "Chart of Accounts", path: "/accounting/coa", icon: "chart", function: hover("Chart of Accounts") },
  { name: "Internal Controls Audit", path: "/accounting/audit", icon: "shield", function: hover("Internal Controls Audit") },
  { name: "AI Close", path: "/accounting/ai-close", icon: "bolt", function: hover("AI Close") },
  { name: "Expense Reporting", path: "/accounting/expenses", icon: "receipt", function: hover("Expense Reporting") },
];
