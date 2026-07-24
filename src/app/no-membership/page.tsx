import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AcceptInviteForm } from "@/components/organization/accept-invite-form";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
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
        title="Welcome to Parable"
        description="Your account is ready. Set up your ministry workspace, or join one with an invite code."
        footer={<SignOutButton />}
      >
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Set up my ministry
            </h2>
            <CreateOrganizationForm />
          </div>

          <div className="space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">
              Join with an invite code
            </h2>
            <AcceptInviteForm />
          </div>
        </div>
      </AuthCard>
    </main>
  );
}
