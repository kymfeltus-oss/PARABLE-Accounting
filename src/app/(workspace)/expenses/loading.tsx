export default function ExpensesLoading() {
  return (
    <section aria-busy="true" aria-label="Loading expenses" className="space-y-8">
      <header className="space-y-2">
        <div className="h-9 w-36 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 max-w-2xl animate-pulse rounded bg-muted" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="h-6 w-36 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
          <div className="mt-6 h-32 animate-pulse rounded-lg bg-muted/60" />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="h-6 w-36 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded bg-muted" />
          <div className="mt-6 h-24 animate-pulse rounded-lg bg-muted/60" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-44 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      </div>
    </section>
  );
}
