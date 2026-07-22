"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { getAuthErrorMessage } from "@/lib/auth/auth-errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 6;

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export function CreateAccountForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password || !confirmPassword) {
      setFeedback({
        type: "error",
        message: "Email, password, and confirm password are required.",
      });
      return;
    }

    if (!trimmedEmail.includes("@")) {
      setFeedback({
        type: "error",
        message: "Enter a valid email address.",
      });
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFeedback({
        type: "error",
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({
        type: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setFeedback({
          type: "error",
          message: getAuthErrorMessage(error),
        });
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setFeedback({
        type: "success",
        message:
          "Check your email to confirm your account before signing in.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      description="Create a Parable Accounting account with your email and password."
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="create-account-email">
            Email
          </label>
          <input
            autoComplete="email"
            className={inputClassName}
            disabled={isSubmitting}
            id="create-account-email"
            name="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="create-account-password">
            Password
          </label>
          <input
            autoComplete="new-password"
            className={inputClassName}
            disabled={isSubmitting}
            id="create-account-password"
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-foreground"
            htmlFor="create-account-confirm-password"
          >
            Confirm password
          </label>
          <input
            autoComplete="new-password"
            className={inputClassName}
            disabled={isSubmitting}
            id="create-account-confirm-password"
            name="confirmPassword"
            required
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {feedback ? (
          <p
            aria-live="polite"
            className={
              feedback.type === "error"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
            role={feedback.type === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
