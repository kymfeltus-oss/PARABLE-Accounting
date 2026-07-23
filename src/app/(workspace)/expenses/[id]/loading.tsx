export default function ExpenseDetailLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading expense detail"
      className="space-y-6"
    >
      <div className="space-y-4">
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-9 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full max-w-xs animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-28 animate-pulse rounded-lg bg-muted/60" />
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-muted/60" />
      </div>
    </section>
  );
}
