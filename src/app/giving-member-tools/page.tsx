import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Giving & member tools | PARABLE",
  description: "Giving, member hub, and congregational tools — workspace entry.",
};

export default function GivingMemberToolsPage() {
  return <ProductWorkspacePlaceholder title="Giving & member tools" slug="/giving-member-tools" />;
}
