import { Button } from "@/components/ui/button";

import {
  expenseStatusFilters,
  type ExpenseStatusCounts,
  type ExpenseStatusFilterId,
} from "./expense-list-filtering";

type ExpenseListToolbarProps = {
  statusFilter: ExpenseStatusFilterId;
  searchQuery: string;
  statusCounts: ExpenseStatusCounts;
  onStatusFilterChange: (filterId: ExpenseStatusFilterId) => void;
  onSearchQueryChange: (query: string) => void;
  onClearSearch: () => void;
};

function formatFilterLabel(
  label: string,
  count: number,
): string {
  return `${label} (${count})`;
}

export function ExpenseListToolbar({
  statusFilter,
  searchQuery,
  statusCounts,
  onStatusFilterChange,
  onSearchQueryChange,
  onClearSearch,
}: ExpenseListToolbarProps) {
  return (
    <div className="space-y-4">
      <div
        aria-label="Expense status filters"
        className="flex flex-wrap gap-2"
        role="group"
      >
        {expenseStatusFilters.map((filter) => {
          const count =
            filter.id === "all"
              ? statusCounts.all
              : filter.id === "draft"
                ? statusCounts.draft
                : statusCounts.recorded;

          return (
            <Button
              key={filter.id}
              aria-pressed={statusFilter === filter.id}
              size="sm"
              type="button"
              variant={statusFilter === filter.id ? "default" : "outline"}
              onClick={() => onStatusFilterChange(filter.id)}
            >
              {formatFilterLabel(filter.label, count)}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <label className="block flex-1 text-sm font-medium text-foreground">
          Search expenses
          <input
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Search by description, reference, vendor, or payment source"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
        {searchQuery.trim() !== "" ? (
          <Button
            className="shrink-0"
            size="sm"
            type="button"
            variant="outline"
            onClick={onClearSearch}
          >
            Clear search
          </Button>
        ) : null}
      </div>
    </div>
  );
}
