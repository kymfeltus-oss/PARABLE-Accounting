import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Ministries & churches | PARABLE",
  description: "Solutions tailored for ministries and churches.",
};

export default function MinistriesChurchesPage() {
  return (
    <ProductWorkspacePlaceholder
      categoryLabel="Business types"
      title="Ministries & churches"
      slug="/business-types/ministries-churches"
    />
  );
}
