import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Accounting workspace | PARABLE",
  description: "Accounting, GL, close, and finance workspace entry.",
};

export default function AccountingWorkspacePage() {
  return <ProductWorkspacePlaceholder title="Accounting workspace" slug="/accounting-workspace" />;
}
