import { MembersPageContent } from "@/components/members/members-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getMembersData } from "@/lib/data/members-repository";

export default async function MembersPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getMembersData(organizationId);

  return <MembersPageContent data={data} />;
}
