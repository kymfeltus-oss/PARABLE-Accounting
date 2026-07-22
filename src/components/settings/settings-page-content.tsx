import Link from "next/link";
import {
  Archive,
  BookOpen,
  LayoutDashboard,
} from "lucide-react";

import { OrganizationMembershipsTable } from "@/components/settings/organization-memberships-table";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { SettingsData } from "@/lib/data/settings-repository";

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

const unavailableConfigurationAreas = [
  "Application preferences",
  "Notification settings",
  "Accounting defaults",
  "Close preferences",
  "Report preferences",
  "Branding controls",
  "Security policy settings",
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
            Recorded organization identity from the current system of record.
          </p>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Name</dt>
            <dd className="mt-1 text-sm text-foreground">{data.organization.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
            <dd className="mt-1 text-sm text-foreground">{data.organization.slug}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Organization ID
            </dt>
            <dd className="mt-1 text-sm text-foreground">{data.organization.id}</dd>
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
            Organization membership records linked to user identifiers. Role and
            membership status fields are not present in the current schema.
          </p>
        </div>

        <div className="mt-6">
          {data.memberships.length === 0 ? (
            <WorkspaceDataEmpty message="No organization memberships yet." />
          ) : (
            <OrganizationMembershipsTable memberships={data.memberships} />
          )}
        </div>
      </section>

      <section
        aria-labelledby="settings-configuration-availability-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="settings-configuration-availability-title"
            className="text-lg font-semibold text-foreground"
          >
            Configuration Availability
          </h2>
          <p className="text-sm text-muted-foreground">
            Organization profile and membership information are shown from the
            current system of record. Configurable application preferences are
            not yet persisted in the current schema.
          </p>
        </div>

        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {unavailableConfigurationAreas.map((area) => (
            <li key={area}>{area} — not persisted</li>
          ))}
        </ul>
      </section>

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
