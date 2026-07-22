import { VendorsPageContent } from "@/components/vendors/vendors-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getVendorsData } from "@/lib/data/vendors-repository";

export default async function VendorsPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getVendorsData(organizationId);

  return <VendorsPageContent data={data} />;
}
