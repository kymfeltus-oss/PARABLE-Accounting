"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { getAuthErrorMessage } from "@/lib/auth/auth-errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "status";
    message: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setFeedback({
        type: "error",
        message: "Email and password are required.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
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

      router.push("/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description="Sign in to Parable Accounting with your email and password."
      footer={
        <p className="text-sm text-muted-foreground">
          Need an account?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/create-account">
            Create account
          </Link>
        </p>
      }
    >
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="login-email">
            Email
          </label>
          <input
            autoComplete="email"
            className={inputClassName}
            disabled={isSubmitting}
            id="login-email"
            name="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="login-password">
            Password
          </label>
          <input
            autoComplete="current-password"
            className={inputClassName}
            disabled={isSubmitting}
            id="login-password"
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
