import { ExceptionsPageContent } from "@/components/exceptions/exceptions-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getExceptionsData } from "@/lib/data/exceptions-repository";

export default async function ExceptionsPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getExceptionsData(organizationId);

  return <ExceptionsPageContent data={data} />;
}
