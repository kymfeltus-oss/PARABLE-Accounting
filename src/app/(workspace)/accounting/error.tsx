"use client";

import { Button } from "@/components/ui/button";

type AccountingErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AccountingError({ reset }: AccountingErrorProps) {
  return (
    <section
      aria-labelledby="accounting-error-title"
      className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <div className="space-y-2">
        <h1
          id="accounting-error-title"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Accounting data could not be loaded
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The Accounting workspace could not retrieve live ledger data right now.
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
