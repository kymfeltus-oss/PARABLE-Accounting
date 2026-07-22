import { AiClosePageContent } from "@/components/ai-close/ai-close-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getAiCloseData } from "@/lib/data/ai-close-repository";

export default async function AIClosePage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getAiCloseData(organizationId);

  return <AiClosePageContent data={data} />;
}
