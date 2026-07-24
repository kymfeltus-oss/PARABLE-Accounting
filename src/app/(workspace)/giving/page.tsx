import { GivingPageContent } from "@/components/giving/giving-page-content";
import { getGivingData } from "@/lib/data/giving-repository";
import {
  getGivingDebitAccountOptions,
  getGivingRevenueAccountOptions,
} from "@/lib/data/giving-recording-options";
import { getMembersData } from "@/lib/data/members-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getFundsData } from "@/lib/data/funds-repository";

export default async function GivingPage() {
  const organizationId = await getCurrentOrganizationId();
  const [data, membersData, fundsData] = await Promise.all([
    getGivingData(organizationId),
    getMembersData(organizationId),
    getFundsData(organizationId),
  ]);

  const [revenueAccountOptions, ...allDebitAccountGroups] = await Promise.all([
    getGivingRevenueAccountOptions(organizationId),
    ...(["cash", "check", "card", "ach", "other"] as const).map((method) =>
      getGivingDebitAccountOptions(organizationId, method),
    ),
  ]);

  const debitAccountsById = new Map<
    string,
    { id: string; label: string; accountType: "asset" | "liability" | "revenue" }
  >();

  for (const options of allDebitAccountGroups) {
    for (const account of options) {
      debitAccountsById.set(account.id, {
        id: account.id,
        label: account.displayLabel,
        accountType: account.accountType,
      });
    }
  }

  return (
    <GivingPageContent
      data={data}
      memberOptions={membersData.members
        .filter((member) => member.status === "active")
        .map((member) => ({
          id: member.id,
          label: `${member.first_name} ${member.last_name}`,
        }))}
      fundOptions={fundsData.funds
        .filter((fund) => fund.status === "active")
        .map((fund) => ({
          id: fund.id,
          label: fund.code ? `${fund.code} · ${fund.name}` : fund.name,
        }))}
      debitAccountOptions={[...debitAccountsById.values()]}
      revenueAccountOptions={revenueAccountOptions.map((account) => ({
        id: account.id,
        label: account.displayLabel,
        accountType: account.accountType,
      }))}
    />
  );
}
