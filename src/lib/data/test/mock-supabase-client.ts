import type { PostgrestError } from "@supabase/supabase-js";

export type MockSupabaseResponse = {
  data?: unknown;
  error?: PostgrestError | null;
  count?: number | null;
};

export type MockSupabaseFilter = {
  method: string;
  args: unknown[];
};

export type MockSupabaseQuery = {
  table: string;
  filters: MockSupabaseFilter[];
};

type MockTableQueues = Record<string, MockSupabaseResponse[]>;

function createPostgrestError(message: string): PostgrestError {
  return {
    message,
    details: "",
    hint: "",
    code: "PGRST000",
  } as PostgrestError;
}

function createThenableBuilder(
  table: string,
  filters: MockSupabaseFilter[],
  tableQueues: MockTableQueues,
  tableCallIndex: Record<string, number>,
  queryLog: MockSupabaseQuery[],
) {
  const builder = {
    select: (...args: unknown[]) => {
      filters.push({ method: "select", args });
      return builder;
    },
    eq: (column: string, value: unknown) => {
      filters.push({ method: "eq", args: [column, value] });
      return builder;
    },
    in: (column: string, values: unknown[]) => {
      filters.push({ method: "in", args: [column, values] });
      return builder;
    },
    gte: (column: string, value: unknown) => {
      filters.push({ method: "gte", args: [column, value] });
      return builder;
    },
    lte: (column: string, value: unknown) => {
      filters.push({ method: "lte", args: [column, value] });
      return builder;
    },
    neq: (column: string, value: unknown) => {
      filters.push({ method: "neq", args: [column, value] });
      return builder;
    },
    not: (column: string, operator: string, value: unknown) => {
      filters.push({ method: "not", args: [column, operator, value] });
      return builder;
    },
    order: (...args: unknown[]) => {
      filters.push({ method: "order", args });
      return builder;
    },
    limit: (...args: unknown[]) => {
      filters.push({ method: "limit", args });
      return builder;
    },
    range: (...args: unknown[]) => {
      filters.push({ method: "range", args });
      return builder;
    },
    then<TResult1 = MockSupabaseResponse, TResult2 = never>(
      onFulfilled?: ((value: MockSupabaseResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      const callIndex = tableCallIndex[table] ?? 0;
      tableCallIndex[table] = callIndex + 1;
      queryLog.push({ table, filters: [...filters] });

      const queue = tableQueues[table] ?? [{ data: [], error: null }];
      const response = queue[callIndex] ?? { data: [], error: null };

      return Promise.resolve(response).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

export function createMockSupabaseClient(tableQueues: MockTableQueues = {}) {
  const queryLog: MockSupabaseQuery[] = [];
  const tableCallIndex: Record<string, number> = {};

  return {
    client: {
      from: (table: string) =>
        createThenableBuilder(
          table,
          [],
          tableQueues,
          tableCallIndex,
          queryLog,
        ),
    },
    queryLog,
  };
}

export function createBackendError(message: string): PostgrestError {
  return createPostgrestError(message);
}

export function hasOrganizationFilter(
  query: MockSupabaseQuery,
  organizationId: string,
): boolean {
  return query.filters.some(
    (filter) =>
      filter.method === "eq" &&
      filter.args[0] === "organization_id" &&
      filter.args[1] === organizationId,
  );
}

export const TEST_ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
