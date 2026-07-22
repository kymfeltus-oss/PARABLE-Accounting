import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { resolveOrganizationContext } from "@/lib/data/organization-context";

export default async function SelectOrganizationPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const resolution = await resolveOrganizationContext(user.id);

  if (resolution.status === "none") {
    redirect("/no-membership");
  }

  if (resolution.status === "resolved") {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <AuthCard
        title="Organization selection required"
        description="Your account belongs to multiple Parable Accounting organizations. Organization selection is required before continuing."
        footer={<SignOutButton />}
      >
        <div className="space-y-4">
          <ul className="space-y-2" aria-label="Available organizations">
            {resolution.organizations.map((organization) => (
              <li
                key={organization.organizationId}
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
              >
                <span className="font-medium">{organization.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {organization.organizationId}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-6 text-muted-foreground">
            Organization switching is not available yet. Sign out and contact your administrator if
            you need access to a specific workspace.
          </p>
        </div>
      </AuthCard>
    </main>
  );
}
