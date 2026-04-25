import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Command center | PARABLE",
  description: "Ministry command center — workspace entry and navigation hub.",
};

export default function CommandCenterWorkspacePage() {
  return <ProductWorkspacePlaceholder title="Command center" slug="/command-center" />;
}
