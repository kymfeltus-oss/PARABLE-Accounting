export default function DashboardLoading() {
  return (
    <section aria-busy="true" aria-label="Loading dashboard" className="space-y-8">
      <header className="space-y-2">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 max-w-2xl animate-pulse rounded bg-muted" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-20 animate-pulse rounded-lg bg-muted/60" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="h-6 w-40 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-56 animate-pulse rounded bg-muted" />
              <div className="mt-6 h-24 animate-pulse rounded-lg bg-muted/60" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-36 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-24 animate-pulse rounded-lg bg-muted/60" />
      </div>
    </section>
  );
}
