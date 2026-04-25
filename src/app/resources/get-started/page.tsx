import type { Metadata } from "next";
import ProductWorkspacePlaceholder from "@/components/workspace/ProductWorkspacePlaceholder";

export const metadata: Metadata = {
  title: "Get started | PARABLE",
  description: "Start your PARABLE Accounting trial or subscription.",
};

export default function ResourcesGetStartedPage() {
  return (
    <ProductWorkspacePlaceholder categoryLabel="Resources" title="Get started" slug="/resources/get-started" />
  );
}
