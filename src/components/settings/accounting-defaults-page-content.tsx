import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { OrganizationSettingsForm } from "@/components/settings/organization-settings-form";
import type {
  OrganizationMembershipRole,
  SettingsData,
} from "@/lib/data/settings-repository";

type AccountingDefaultsPageContentProps = {
  data: SettingsData;
};

const membershipRoleLabels: Record<OrganizationMembershipRole, string> = {
  owner: "Owner",
  accountant: "Accountant",
  staff: "Staff",
  viewer: "Viewer",
};

function canEditAccountingDefaults(role: OrganizationMembershipRole): boolean {
  return role === "owner" || role === "accountant";
}

export function AccountingDefaultsPageContent({
  data,
}: AccountingDefaultsPageContentProps) {
  const canEdit = canEditAccountingDefaults(data.currentUserRole);

  return (
    <section aria-labelledby="accounting-defaults-title" className="space-y-6">
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/settings"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to settings
        </Link>

        <header className="space-y-2">
          <h1
            id="accounting-defaults-title"
            className="text-3xl font-semibold tracking-tight text-foreground"
          >
            Accounting Defaults
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Set the fiscal year start and default cash/revenue accounts used when
            recording giving to the ledger.
          </p>
        </header>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        {canEdit ? (
          <OrganizationSettingsForm
            accounts={data.accounts}
            settings={data.settings}
          />
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            Only owners and accountants can edit accounting defaults. Your role
            is {membershipRoleLabels[data.currentUserRole]}.
          </p>
        )}
      </div>
    </section>
  );
}

export type { AccountingDefaultsPageContentProps };
