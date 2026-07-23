"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type ExpenseDetailErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ExpenseDetailError({ reset }: ExpenseDetailErrorProps) {
  return (
    <section
      aria-labelledby="expense-detail-error-title"
      className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <div className="space-y-2">
        <h1
          id="expense-detail-error-title"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Expense could not be loaded
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          This expense detail view could not retrieve live expense data right
          now. Please try again. If the problem continues, return to the expense
          list and verify the expense is still available.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/expenses">Back to expenses</Link>
        </Button>
      </div>
    </section>
  );
}
