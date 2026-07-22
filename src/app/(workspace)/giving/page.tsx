import { GivingPageContent } from "@/components/giving/giving-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getGivingData } from "@/lib/data/giving-repository";

export default async function GivingPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getGivingData(organizationId);

  return <GivingPageContent data={data} />;
}
