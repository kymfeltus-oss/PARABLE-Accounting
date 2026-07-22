"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getAuthErrorMessage } from "@/lib/auth/auth-errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(getAuthErrorMessage(error));
        return;
      }

      router.push("/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={isSubmitting}
        size="sm"
        type="button"
        variant="outline"
        onClick={handleSignOut}
      >
        {isSubmitting ? "Signing out..." : "Sign out"}
      </Button>
      {errorMessage ? (
        <p aria-live="polite" className="max-w-48 text-right text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
