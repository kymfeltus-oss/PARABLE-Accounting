"use client";

import { Button } from "@/components/ui/button";

type MembersErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function MembersError({ reset }: MembersErrorProps) {
  return (
    <section
      aria-labelledby="members-error-title"
      className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <div className="space-y-2">
        <h1
          id="members-error-title"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Members data could not be loaded
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The Members workspace could not retrieve live roster data right now.
          Please try again. If the problem continues, verify the server
          configuration for this workspace.
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
