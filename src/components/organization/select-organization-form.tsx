"use client";

import { selectOrganizationAction } from "@/app/organization/actions";
import { Button } from "@/components/ui/button";
import type { UserOrganizationSummary } from "@/lib/data/organization-context";

type SelectOrganizationFormProps = {
  organizations: UserOrganizationSummary[];
};

export function SelectOrganizationForm({
  organizations,
}: SelectOrganizationFormProps) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2" aria-label="Available organizations">
        {organizations.map((organization) => (
          <li key={organization.organizationId}>
            <form action={selectOrganizationAction}>
              <input
                name="organizationId"
                type="hidden"
                value={organization.organizationId}
              />
              <Button
                className="h-auto w-full justify-start px-3 py-3"
                type="submit"
                variant="outline"
              >
                <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                  <span className="font-medium">{organization.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {organization.organizationId}
                  </span>
                </span>
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-sm leading-6 text-muted-foreground">
        Choose the organization you want to open. You can switch again later
        from settings when multiple memberships are active.
      </p>
    </div>
  );
}

export type { SelectOrganizationFormProps };
