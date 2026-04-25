import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Mid-size ministry | PARABLE",
  description: "Scale-ready accounting for mid-size ministries.",
};

export default function MidSizeMinistryPage() {
  return (
    <ProductWorkspacePlaceholder
      categoryLabel="Business types"
      title="Mid-size ministry"
      slug="/business-types/mid-size-ministry"
    />
  );
}
