import type { Metadata } from "next";
import ChartOfAccountsClient from "@/components/ledger/ChartOfAccountsClient";

export const metadata: Metadata = {
  title: "Chart of accounts",
  description: "UCOA chart with sub-accounts, roll-up helpers, and audit-ready structure.",
};

export default function ChartOfAccountsPage() {
  return <ChartOfAccountsClient />;
}
