import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Small ministry | PARABLE",
  description: "Accounting and operations for small ministries.",
};

export default function SmallMinistryPage() {
  return (
    <ProductWorkspacePlaceholder
      categoryLabel="Business types"
      title="Small ministry"
      slug="/business-types/small-ministry"
    />
  );
}
