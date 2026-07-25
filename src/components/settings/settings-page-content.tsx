import Link from "next/link";
import {
  Archive,
  BookOpen,
  LayoutDashboard,
  SlidersHorizontal,
} from "lucide-react";

import { CreateInviteForm } from "@/components/settings/create-invite-form";
import { OrganizationInvitesTable } from "@/components/settings/organization-invites-table";
import { OrganizationMembershipsTable } from "@/components/settings/organization-memberships-table";
import { OrganizationProfileForm } from "@/components/settings/organization-profile-form";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type {
  OrganizationMembershipRole,
  SettingsData,
} from "@/lib/data/settings-repository";

const summaryLabels = [
  "Total Memberships",
  "Organization Status",
  "Organization Created",
] as const;

const navigationLinks = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    description: "Return to the workspace overview",
    icon: LayoutDashboard,
  },
  {
    id: "accounting",
    label: "Accounting",
    href: "/accounting",
    description: "Review ledger and journal records",
    icon: BookOpen,
  },
  {
    id: "audit-vault",
    label: "Audit Vault",
    href: "/audit-vault",
    description: "Open audit events and document metadata",
    icon: Archive,
  },
] as const;

type SettingsPageContentProps = {
  data: SettingsData;
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const membershipRoleLabels: Record<OrganizationMembershipRole, string> = {
  owner: "Owner",
  accountant: "Accountant",
  staff: "Staff",
  viewer: "Viewer",
};

function formatMembershipRole(role: OrganizationMembershipRole): string {
  return membershipRoleLabels[role];
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: SettingsData,
): string {
  switch (label) {
    case "Total Memberships":
      return String(data.counts.totalMemberships);
    case "Organization Status":
      return formatLabel(data.organization.status);
    case "Organization Created":
      return formatDateTime(data.organization.created_at);
    default:
      return "—";
  }
}

export function SettingsPageContent({ data }: SettingsPageContentProps) {
  const settingsNav = getNavItemByPathname("/settings");
  const isOwner = data.currentUserRole === "owner";

  if (!settingsNav) {
    throw new Error("Settings navigation item is not configured.");
  }

  return (
    <section aria-labelledby="settings-title" className="space-y-8">
      <header className="space-y-2">
        <h1
          id="settings-title"
          className="text-3xl font-semibold tracking-tight text-foreground"
        >
          {settingsNav.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {settingsNav.description}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaryLabels.map((label) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {formatSummaryValue(label, data)}
            </p>
          </article>
        ))}
      </div>

      <section
        aria-labelledby="settings-accounting-defaults-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2
              id="settings-accounting-defaults-title"
              className="text-lg font-semibold text-foreground"
            >
              Accounting Defaults
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Set fiscal year timing and the default cash/revenue accounts used
              when posting giving to the ledger.
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto" type="button">
            <Link href="/settings/accounting-defaults">
              <SlidersHorizontal aria-hidden className="size-4" />
              Open accounting defaults
            </Link>
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="settings-organization-profile-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="settings-organization-profile-title"
            className="text-lg font-semibold text-foreground"
          >
            Organization Profile
          </h2>
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "Update the organization name shown across the workspace."
              : "Recorded organization identity from the current system of record."}
          </p>
        </div>

        <div className="mt-6">
          {isOwner ? (
            <OrganizationProfileForm organization={data.organization} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Name</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {data.organization.name}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Ministry web name
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {data.organization.slug}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Workspace ID
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {data.organization.id}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatLabel(data.organization.status)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatDateTime(data.organization.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatDateTime(data.organization.updated_at)}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <section
        aria-labelledby="settings-access-membership-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="settings-access-membership-title"
            className="text-lg font-semibold text-foreground"
          >
            Access & Membership
          </h2>
          <p className="text-sm text-muted-foreground">
            People who can access this ministry workspace and their roles.
          </p>
        </div>

        <dl className="mt-6">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Your role
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatMembershipRole(data.currentUserRole)}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          {data.memberships.length === 0 ? (
            <WorkspaceDataEmpty message="No organization memberships yet." />
          ) : (
            <OrganizationMembershipsTable
              canManageRoles={isOwner}
              memberships={data.memberships}
            />
          )}
        </div>
      </section>

      {isOwner ? (
        <section
          aria-labelledby="settings-organization-invites-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="settings-organization-invites-title"
              className="text-lg font-semibold text-foreground"
            >
              Team Invites
            </h2>
            <p className="text-sm text-muted-foreground">
              Create an invite code, share it with a teammate, and have them join
              from the Welcome page after they sign in.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <CreateInviteForm />
            <OrganizationInvitesTable invites={data.invites} />
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="settings-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="settings-related-workspaces-title"
            className="text-lg font-semibold text-foreground"
          >
            Related Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Navigate to connected overview and review areas.
          </p>
        </div>

        <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {navigationLinks.map((link) => (
            <li key={link.id}>
              <Button
                asChild
                className="h-auto w-full justify-start px-3 py-3"
                variant="outline"
              >
                <Link href={link.href}>
                  <link.icon aria-hidden className="size-4" />
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="font-medium">{link.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {link.description}
                    </span>
                  </span>
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

export type { SettingsPageContentProps };
