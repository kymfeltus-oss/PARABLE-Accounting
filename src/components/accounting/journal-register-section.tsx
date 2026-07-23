"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  JournalRegisterTable,
  type JournalRegisterFilters,
  type JournalRegisterRow,
} from "@/components/accounting/journal-register-table";

export type JournalRegisterSectionProps = {
  rows: JournalRegisterRow[];
  filters: JournalRegisterFilters;
  page: number;
  pageSize: number;
  totalCount: number;
};

function buildSearchParams(
  current: URLSearchParams,
  updates: Partial<JournalRegisterFilters & { page?: number }>,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());

  if (updates.search !== undefined) {
    const trimmed = updates.search.trim();

    if (trimmed) {
      params.set("search", trimmed);
    } else {
      params.delete("search");
    }

    params.delete("page");
  }

  if (updates.status !== undefined) {
    if (updates.status === "all") {
      params.delete("status");
    } else {
      params.set("status", updates.status);
    }

    params.delete("page");
  }

  if (updates.source !== undefined) {
    if (updates.source === "all") {
      params.delete("source");
    } else {
      params.set("source", updates.source);
    }

    params.delete("page");
  }

  if (updates.page !== undefined) {
    if (updates.page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(updates.page));
    }
  }

  return params;
}

export function JournalRegisterSection({
  rows,
  filters,
  page,
  pageSize,
  totalCount,
}: JournalRegisterSectionProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasPagination = totalCount > pageSize;

  function navigate(
    updates: Partial<JournalRegisterFilters & { page?: number }>,
  ): void {
    const params = buildSearchParams(searchParams, updates);
    const query = params.toString();

    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="space-y-4">
      <JournalRegisterTable
        filters={filters}
        onFiltersChange={(nextFilters) => navigate(nextFilters)}
        rows={rows}
      />

      {hasPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p role="status">
            Showing page {page} of {totalPages} ({totalCount} journal entries)
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page <= 1}
              type="button"
              onClick={() => navigate({ page: page - 1 })}
            >
              Previous
            </button>
            <button
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page >= totalPages}
              type="button"
              onClick={() => navigate({ page: page + 1 })}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { buildSearchParams };
