import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { resolveOrganizationContext } from "@/lib/data/organization-context";

export default async function NoMembershipPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const resolution = await resolveOrganizationContext(user.id);

  if (resolution.status === "resolved") {
    redirect("/dashboard");
  }

  if (resolution.status === "multiple") {
    redirect("/select-organization");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <AuthCard
        title="No organization access"
        description="Your account is signed in, but it is not currently connected to a Parable Accounting organization."
        footer={<SignOutButton />}
      >
        <p className="text-sm leading-6 text-muted-foreground">
          Contact your organization administrator if you expected access to a workspace.
        </p>
      </AuthCard>
    </main>
  );
}
