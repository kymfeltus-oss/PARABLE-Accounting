"use client";

import { Button } from "@/components/ui/button";

type AICloseErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AICloseError({ reset }: AICloseErrorProps) {
  return (
    <section
      aria-labelledby="ai-close-error-title"
      className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <div className="space-y-2">
        <h1
          id="ai-close-error-title"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Period Close data could not be loaded
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The Period Close workspace could not retrieve live close session data
          right now. Please try again. If the problem continues, verify the
          server configuration for this workspace.
        </p>
      </div>

      <div className="mt-6">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </section>
  );
}
