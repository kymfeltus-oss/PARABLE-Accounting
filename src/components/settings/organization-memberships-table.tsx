import type { OrganizationMembershipRow } from "@/lib/data/types/rows";

type OrganizationMembershipsTableProps = {
  memberships: OrganizationMembershipRow[];
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function OrganizationMembershipsTable({
  memberships,
}: OrganizationMembershipsTableProps) {
  if (memberships.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No organization memberships recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">User ID</th>
            <th className="px-3 py-2 font-medium">Joined</th>
            <th className="px-3 py-2 font-medium">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((membership) => (
            <tr key={membership.id} className="border-b border-border/70 align-top">
              <td className="px-3 py-3 font-medium text-foreground">
                {membership.user_id}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatDateTime(membership.created_at)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatDateTime(membership.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { OrganizationMembershipsTableProps };
