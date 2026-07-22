export default function SettingsLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading settings"
      className="space-y-8"
    >
      <header className="space-y-2">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 max-w-2xl animate-pulse rounded bg-muted" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-44 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-32 animate-pulse rounded-lg bg-muted/60" />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-52 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-4 w-64 animate-pulse rounded bg-muted/60" />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-44 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      </div>
    </section>
  );
}
