import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { resolveOrganizationContextForAuthenticatedUser } from "@/lib/data/organization-context";

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

  return <AppShell>{children}</AppShell>;
}
