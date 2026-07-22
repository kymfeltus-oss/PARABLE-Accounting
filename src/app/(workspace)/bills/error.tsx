"use client";

import { Button } from "@/components/ui/button";

type BillsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function BillsError({ reset }: BillsErrorProps) {
  return (
    <section
      aria-labelledby="bills-error-title"
      className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <div className="space-y-2">
        <h1
          id="bills-error-title"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Bills data could not be loaded
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The Bills workspace could not retrieve live payables data right now.
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
