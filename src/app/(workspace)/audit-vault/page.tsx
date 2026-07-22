import { AuditVaultPageContent } from "@/components/audit-vault/audit-vault-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getAuditVaultData } from "@/lib/data/audit-vault-repository";

export default async function AuditVaultPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getAuditVaultData(organizationId);

  return <AuditVaultPageContent data={data} />;
}
