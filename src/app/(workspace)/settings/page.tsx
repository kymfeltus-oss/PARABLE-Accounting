import { SettingsPageContent } from "@/components/settings/settings-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getSettingsData } from "@/lib/data/settings-repository";

export default async function SettingsPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getSettingsData(organizationId);

  return <SettingsPageContent data={data} />;
}
