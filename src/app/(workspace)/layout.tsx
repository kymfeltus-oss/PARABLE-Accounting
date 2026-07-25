import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getUserDisplayName } from "@/lib/auth/user-display-name";
import { resolveOrganizationContextForAuthenticatedUser } from "@/lib/data/organization-context";
import { getUserOrganizationMemberships } from "@/lib/data/organization-membership-repository";

type WorkspaceLayoutProps = {
  children: React.ReactNode;
};

export default async function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const resolution = await resolveOrganizationContextForAuthenticatedUser();

  if (resolution.status === "unauthenticated") {
    redirect("/login");
  }

  if (resolution.status === "none") {
    redirect("/no-membership");
  }

  if (resolution.status === "multiple") {
    redirect("/select-organization");
  }

  const memberships = await getUserOrganizationMemberships(user.id);
  const organizationName =
    memberships.find(
      (membership) => membership.organizationId === resolution.organizationId,
    )?.name ?? "Organization";

  return (
    <AppShell
      identity={{
        organizationName,
        userDisplayName: getUserDisplayName(user),
        userEmail: user.email ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
