"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type GivingDetailErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GivingDetailError({ reset }: GivingDetailErrorProps) {
  return (
    <section
      aria-labelledby="giving-detail-error-title"
      className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <div className="space-y-2">
        <h1
          id="giving-detail-error-title"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Giving could not be loaded
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          This giving detail view could not retrieve live giving data right now.
          Please try again. If the problem continues, return to the giving list
          and verify the gift is still available.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/giving">Back to giving</Link>
        </Button>
      </div>
    </section>
  );
}
