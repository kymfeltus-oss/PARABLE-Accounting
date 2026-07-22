export default function ComplianceLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading compliance"
      className="space-y-8"
    >
      <header className="space-y-2">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 max-w-2xl animate-pulse rounded bg-muted" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-muted" />
        <div className="mt-4 flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-8 w-28 animate-pulse rounded bg-muted/60" />
          ))}
        </div>
        <div className="mt-4 h-10 w-full max-w-md animate-pulse rounded bg-muted/60" />
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-muted/60" />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-44 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      </div>
    </section>
  );
}
