import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Product tour | PARABLE",
  description: "Walk through PARABLE Accounting capabilities.",
};

export default function ResourcesProductTourPage() {
  return (
    <ProductWorkspacePlaceholder
      categoryLabel="Resources"
      title="Product tour"
      slug="/resources/product-tour"
    />
  );
}
