import Link from "next/link";
import { ArrowUpRight, BarChart3, HandCoins, Wallet } from "lucide-react";

import { CreateMemberForm } from "@/components/members/create-member-form";
import { EditMemberForm } from "@/components/members/edit-member-form";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { MembersData } from "@/lib/data/members-repository";
import { getMonthDateRange } from "@/lib/data/query-helpers";
import type { MemberRow } from "@/lib/data/types/rows";

const summaryLabels = [
  "Total Members",
  "Active Members",
  "New This Month",
  "Inactive Members",
] as const;

const segmentLabels = ["New Members", "Inactive Members"] as const;

const insightLabels = ["Newest member"] as const;

const navigationLinks = [
  {
    id: "giving",
    label: "Giving",
    href: "/giving",
    description: "Review recorded gifts and batches",
    icon: HandCoins,
  },
  {
    id: "funds",
    label: "Funds",
    href: "/funds",
    description: "Inspect designated fund balances",
    icon: Wallet,
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    description: "Open financial reports",
    icon: BarChart3,
  },
] as const;

type MembersPageContentProps = {
  data: MembersData;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatMemberName(member: MemberRow): string {
  return `${member.first_name} ${member.last_name}`.trim();
}

function getMembersCreatedThisMonth(members: MemberRow[]): MemberRow[] {
  const { startDate, endDate } = getMonthDateRange();

  return members.filter((member) => {
    const createdDate = member.created_at.slice(0, 10);
    return createdDate >= startDate && createdDate <= endDate;
  });
}

function getNewestMember(members: MemberRow[]): MemberRow | null {
  if (members.length === 0) {
    return null;
  }

  return [...members].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  )[0]!;
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: MembersData,
  newThisMonthCount: number,
): string {
  switch (label) {
    case "Total Members":
      return String(data.counts.total);
    case "Active Members":
      return String(data.counts.active);
    case "New This Month":
      return String(newThisMonthCount);
    case "Inactive Members":
      return String(data.counts.inactive);
    default:
      return "0";
  }
}

function formatSegmentValue(
  label: (typeof segmentLabels)[number],
  data: MembersData,
  newThisMonthCount: number,
): string {
  switch (label) {
    case "New Members":
      return newThisMonthCount > 0
        ? `${newThisMonthCount} member${newThisMonthCount === 1 ? "" : "s"}`
        : "No members in this segment yet.";
    case "Inactive Members":
      return data.counts.inactive > 0
        ? `${data.counts.inactive} member${data.counts.inactive === 1 ? "" : "s"}`
        : "No members in this segment yet.";
    default:
      return "No members in this segment yet.";
  }
}

function formatInsightValue(
  label: (typeof insightLabels)[number],
  members: MemberRow[],
): string {
  switch (label) {
    case "Newest member": {
      const newestMember = getNewestMember(members);
      return newestMember
        ? `${formatMemberName(newestMember)} (${formatDate(newestMember.created_at)})`
        : "No data available yet.";
    }
    default:
      return "No data available yet.";
  }
}

function hasMemberActivity(data: MembersData): boolean {
  return data.members.length > 0;
}

export function MembersPageContent({ data }: MembersPageContentProps) {
  const membersNav = getNavItemByPathname("/members");

  if (!membersNav) {
    throw new Error("Members navigation item is not configured.");
  }

  const newThisMonth = getMembersCreatedThisMonth(data.members);

  return (
    <section aria-labelledby="members-title" className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1
              id="members-title"
              className="text-3xl font-semibold tracking-tight text-foreground"
            >
              {membersNav.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {membersNav.description}
            </p>
          </div>
          <CreateMemberForm />
        </div>
      </header>

      {!hasMemberActivity(data) ? (
        <WorkspaceDataEmpty message="No members yet." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLabels.map((label) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {formatSummaryValue(label, data, newThisMonth.length)}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="members-directory-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="members-directory-title"
              className="text-lg font-semibold text-foreground"
            >
              Member Directory
            </h2>
            <p className="text-sm text-muted-foreground">
              Member contact profiles currently on record.
            </p>
          </div>

          <div className="mt-6">
            {data.members.length === 0 ? (
              <WorkspaceDataEmpty message="No members yet." />
            ) : (
              <ul className="space-y-3">
                {data.members.map((member) => (
                  <li
                    key={member.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {formatMemberName(member)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {member.email ?? "No email recorded"} ·{" "}
                          {member.phone ?? "No phone recorded"}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {member.status} · Joined {formatDate(member.created_at)}
                        </p>
                      </div>
                      <EditMemberForm member={member} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="members-segments-title"
            className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="space-y-1">
              <h2
                id="members-segments-title"
                className="text-lg font-semibold text-foreground"
              >
                Member Segments
              </h2>
              <p className="text-sm text-muted-foreground">
                Simple segments based on membership status and join date.
              </p>
            </div>

            <ul className="mt-6 space-y-4">
              {segmentLabels.map((name) => (
                <li
                  key={name}
                  className="rounded-lg border border-border/70 bg-muted/20 p-4"
                >
                  <p className="font-medium text-foreground">{name}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatSegmentValue(name, data, newThisMonth.length)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="members-insights-title"
            className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="space-y-1">
              <h2
                id="members-insights-title"
                className="text-lg font-semibold text-foreground"
              >
                Member Insights
              </h2>
              <p className="text-sm text-muted-foreground">
                Highlights from the current member roster.
              </p>
            </div>

            <dl className="mt-6 space-y-4">
              {insightLabels.map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-border/70 bg-muted/20 p-4"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-2 text-sm text-muted-foreground">
                    {formatInsightValue(label, data.members)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="members-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="members-related-workspaces-title"
            className="text-lg font-semibold text-foreground"
          >
            Related Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Navigate to connected ministry accounting areas.
          </p>
        </div>

        <ul className="mt-6 grid gap-3 md:grid-cols-3">
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
                    <span className="inline-flex items-center gap-1 font-medium">
                      {link.label}
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    </span>
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

export type { MembersPageContentProps };
