import { BillsPageContent } from "@/components/bills/bills-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getBillsData } from "@/lib/data/bills-repository";

export default async function BillsPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getBillsData(organizationId);

  return <BillsPageContent data={data} />;
}
