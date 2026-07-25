import { AccountingDefaultsPageContent } from "@/components/settings/accounting-defaults-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getSettingsData } from "@/lib/data/settings-repository";

export default async function AccountingDefaultsPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getSettingsData(organizationId);

  return <AccountingDefaultsPageContent data={data} />;
}
