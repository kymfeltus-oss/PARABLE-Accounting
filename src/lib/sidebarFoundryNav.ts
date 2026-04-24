import { sidebarNavigation as _sidebarV2 } from "../../sidebarConfig_v2.js";

/** Sub-item icons: inline SVG keys in `FoundryNavIcon` */
export type FoundrySubIconId =
  | "document"
  | "bank"
  | "grid"
  | "fileTax"
  | "chart"
  | "shield"
  | "bolt"
  | "receipt";

export type FoundrySubMenu = {
  name: string;
  path: string;
  icon: FoundrySubIconId;
  /** One-line CFO-style descriptor for tooltips & hub copy */
  function?: string;
};

export type FoundryModule = {
  name: string;
  icon: string;
  path: string;
};

export const FOUNDRY_CFO_HOVER: Record<string, string> = {
  "Accounts Payable": "Vendor management & liability tracking.",
  "Accounts Receivables": "Revenue streams & donation pledges.",
  "General Ledger": "Double-entry source of truth.",
  Taxes: "Payroll (941/944) and compliance filings.",
  "Chart of Accounts": "The UCOA structural DNA.",
  "Internal Controls Audit": "Continuous monitoring — IRS Pub. 1828 heuristics.",
  "AI Close": "4-gate autonomous month-end close engine.",
  "Expense Reporting": "Mobile capture & reimbursement pipeline.",
};

const v2 = _sidebarV2 as unknown as FoundryModule[];

/** Left rail: flat modules only (no nested lists). */
export const sidebarNavigation: FoundryModule[] = v2;

/**
 * Audit mode: same top-level shape — still land on /accounting for the in-screen hub.
 */
export const sidebarAuditModule: FoundryModule[] = [
  { name: "Accounting", icon: "CalculatorIcon", path: "/accounting" },
  { name: "Reporting", icon: "ChartBarIcon", path: "/reporting" },
  { name: "Parable Giving", icon: "GiftIcon", path: "/giving" },
  { name: "Documents", icon: "FolderIcon", path: "/vault" },
];
