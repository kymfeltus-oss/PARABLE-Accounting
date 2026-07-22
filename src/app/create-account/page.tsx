import { redirect } from "next/navigation";

import { CreateAccountForm } from "@/components/auth/create-account-form";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

export default async function CreateAccountPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <CreateAccountForm />
    </main>
  );
}
