import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SelectOrganizationForm } from "@/components/organization/select-organization-form";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { resolveOrganizationContextForAuthenticatedUser } from "@/lib/data/organization-context";

export default async function SelectOrganizationPage() {
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

  if (resolution.status === "resolved") {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <AuthCard
        title="Organization selection required"
        description="Your account belongs to multiple Parable Accounting organizations. Select one to continue."
        footer={<SignOutButton />}
      >
        <SelectOrganizationForm organizations={resolution.organizations} />
      </AuthCard>
    </main>
  );
}
