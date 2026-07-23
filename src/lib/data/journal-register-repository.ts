import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { AccountingPeriodRow, JournalEntryRow } from "./types/rows";

export type JournalRegisterQuery = {
  search?: string;
  status?: "all" | "draft" | "posted" | "reversed";
  source?:
    | "all"
    | "expense"
    | "giving"
    | "manual"
    | "banking"
    | "opening_balance"
    | "other";
  page?: number;
  pageSize?: number;
};

export type JournalRegisterEntry = {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  source:
    | "expense"
    | "giving"
    | "manual"
    | "banking"
    | "opening_balance"
    | "other";
  sourceReference: string | null;
  periodName: string | null;
  status: "draft" | "posted" | "reversed";
  totalDebit: number;
  totalCredit: number;
};

export type JournalRegisterResult = {
  entries: JournalRegisterEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
};

type JournalRegisterJournalRow = Pick<
  JournalEntryRow,
  | "id"
  | "organization_id"
  | "accounting_period_id"
  | "entry_number"
  | "entry_date"
  | "description"
  | "source_type"
  | "status"
> & {
  source_id: string | null;
};

type JournalRegisterLineRow = {
  journal_entry_id: string;
  debit_amount: number | string;
  credit_amount: number | string;
};

type ExpenseReferenceRow = {
  id: string;
  reference: string | null;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const KNOWN_REGISTER_SOURCES = new Set<JournalRegisterEntry["source"]>([
  "expense",
  "giving",
  "manual",
  "banking",
  "opening_balance",
  "other",
]);

const OTHER_DATABASE_SOURCE_TYPES = ["bill", "adjustment", "closing"] as const;

type JournalRegisterStatusFilter = NonNullable<JournalRegisterQuery["status"]>;
type JournalRegisterSourceFilter = NonNullable<JournalRegisterQuery["source"]>;

function normalizeAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

export function clampJournalRegisterPage(page?: number): number {
  if (page === undefined || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function clampJournalRegisterPageSize(pageSize?: number): number {
  if (pageSize === undefined || !Number.isFinite(pageSize) || pageSize < 1) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), MAX_PAGE_SIZE);
}

export function normalizeJournalRegisterStatus(
  status?: string,
): JournalRegisterStatusFilter {
  if (status === "draft" || status === "posted" || status === "reversed") {
    return status;
  }

  return "all";
}

export function normalizeJournalRegisterSource(
  source?: string,
): JournalRegisterSourceFilter {
  if (source === "all") {
    return "all";
  }

  if (
    source &&
    KNOWN_REGISTER_SOURCES.has(source as JournalRegisterEntry["source"])
  ) {
    return source as JournalRegisterSourceFilter;
  }

  return "all";
}

export function mapDatabaseSourceType(
  sourceType: string,
): JournalRegisterEntry["source"] {
  switch (sourceType) {
    case "expense":
      return "expense";
    case "giving":
      return "giving";
    case "manual":
      return "manual";
    case "banking":
      return "banking";
    case "opening_balance":
      return "opening_balance";
    default:
      return "other";
  }
}

export function resolveDatabaseSourceTypes(
  source: JournalRegisterQuery["source"],
): string[] | null {
  switch (source) {
    case "all":
      return null;
    case "expense":
      return ["expense"];
    case "giving":
      return ["giving"];
    case "manual":
      return ["manual"];
    case "banking":
      return ["banking"];
    case "opening_balance":
      return ["opening_balance"];
    case "other":
      return [...OTHER_DATABASE_SOURCE_TYPES];
    default:
      return null;
  }
}

function isJournalStatus(
  value: string,
): value is JournalRegisterEntry["status"] {
  return value === "draft" || value === "posted" || value === "reversed";
}

function buildLineTotals(
  lines: JournalRegisterLineRow[],
  journalEntryIds: Set<string>,
): Map<string, { totalDebit: number; totalCredit: number }> {
  const totals = new Map<string, { totalDebit: number; totalCredit: number }>();

  for (const line of lines) {
    if (!journalEntryIds.has(line.journal_entry_id)) {
      continue;
    }

    const current = totals.get(line.journal_entry_id) ?? {
      totalDebit: 0,
      totalCredit: 0,
    };

    current.totalDebit += normalizeAmount(line.debit_amount);
    current.totalCredit += normalizeAmount(line.credit_amount);
    totals.set(line.journal_entry_id, current);
  }

  return totals;
}

function compareJournalEntries(
  left: JournalRegisterEntry,
  right: JournalRegisterEntry,
): number {
  const dateCompare = right.entryDate.localeCompare(left.entryDate);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  const numberCompare = right.entryNumber.localeCompare(left.entryNumber);

  if (numberCompare !== 0) {
    return numberCompare;
  }

  return right.id.localeCompare(left.id);
}

function matchesSearchTerm(
  entry: JournalRegisterEntry,
  searchTerm: string,
): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [
    entry.entryNumber,
    entry.description,
    entry.sourceReference ?? "",
    entry.periodName ?? "",
  ].some((value) => value.toLowerCase().includes(normalizedSearch));
}

function toJournalRegisterEntry(
  journal: JournalRegisterJournalRow,
  periodName: string | null,
  sourceReference: string | null,
  totals: { totalDebit: number; totalCredit: number },
): JournalRegisterEntry {
  if (!isJournalStatus(journal.status)) {
    throw new DataAccessError({
      operation: "getJournalRegister",
      message: `Unexpected journal entry status: ${journal.status}`,
    });
  }

  return {
    id: journal.id,
    entryNumber: journal.entry_number,
    entryDate: journal.entry_date,
    description: journal.description,
    source: mapDatabaseSourceType(journal.source_type),
    sourceReference,
    periodName,
    status: journal.status,
    totalDebit: totals.totalDebit,
    totalCredit: totals.totalCredit,
  };
}

export async function getJournalRegister(
  organizationId: string,
  query: JournalRegisterQuery = {},
): Promise<JournalRegisterResult> {
  const operation = "getJournalRegister";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const normalizedStatus = normalizeJournalRegisterStatus(query.status);
  const normalizedSource = normalizeJournalRegisterSource(query.source);
  const page = clampJournalRegisterPage(query.page);
  const pageSize = clampJournalRegisterPageSize(query.pageSize);
  const searchTerm = query.search?.trim() ?? "";
  const databaseSourceTypes = resolveDatabaseSourceTypes(normalizedSource);

  if (databaseSourceTypes?.length === 0) {
    return {
      entries: [],
      totalCount: 0,
      page,
      pageSize,
    };
  }

  const supabase = await createServerSupabaseClient();

  let journalQuery = supabase
    .from("journal_entries")
    .select(
      "id, organization_id, accounting_period_id, entry_number, entry_date, description, source_type, source_id, status",
    )
    .eq("organization_id", scopedOrganizationId);

  if (normalizedStatus !== "all") {
    journalQuery = journalQuery.eq("status", normalizedStatus);
  }

  if (databaseSourceTypes) {
    journalQuery = journalQuery.in("source_type", databaseSourceTypes);
  }

  journalQuery = journalQuery
    .order("entry_date", { ascending: false })
    .order("entry_number", { ascending: false })
    .order("id", { ascending: false });

  const journalResult = await journalQuery;
  const journals = unwrapRows<JournalRegisterJournalRow>(
    `${operation}.journals`,
    journalResult,
  ).filter((journal) => journal.organization_id === scopedOrganizationId);

  if (journals.length === 0) {
    return {
      entries: [],
      totalCount: 0,
      page,
      pageSize,
    };
  }

  const journalEntryIds = journals.map((journal) => journal.id);
  const journalEntryIdSet = new Set(journalEntryIds);
  const accountingPeriodIds = [
    ...new Set(journals.map((journal) => journal.accounting_period_id)),
  ];
  const expenseSourceIds = [
    ...new Set(
      journals
        .filter(
          (journal) => journal.source_type === "expense" && journal.source_id,
        )
        .map((journal) => journal.source_id as string),
    ),
  ];

  const [periodsResult, linesResult, expensesResult] = await Promise.all([
    supabase
      .from("accounting_periods")
      .select("id, name, organization_id")
      .eq("organization_id", scopedOrganizationId)
      .in("id", accountingPeriodIds),
    supabase
      .from("journal_entry_lines")
      .select("journal_entry_id, debit_amount, credit_amount")
      .in("journal_entry_id", journalEntryIds),
    expenseSourceIds.length > 0
      ? supabase
          .from("expenses")
          .select("id, reference")
          .eq("organization_id", scopedOrganizationId)
          .in("id", expenseSourceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const periods = unwrapRows<Pick<AccountingPeriodRow, "id" | "name" | "organization_id">>(
    `${operation}.periods`,
    periodsResult,
  ).filter((period) => period.organization_id === scopedOrganizationId);
  const lines = unwrapRows<JournalRegisterLineRow>(
    `${operation}.lines`,
    linesResult,
  ).filter((line) => journalEntryIdSet.has(line.journal_entry_id));
  const expenses = unwrapRows<ExpenseReferenceRow>(
    `${operation}.expenses`,
    expensesResult,
  );

  const periodNameById = new Map(
    periods.map((period) => [period.id, period.name]),
  );
  const expenseReferenceById = new Map(
    expenses.map((expense) => [expense.id, expense.reference]),
  );
  const lineTotals = buildLineTotals(lines, journalEntryIdSet);

  const entries = journals.map((journal) => {
    const totals = lineTotals.get(journal.id) ?? {
      totalDebit: 0,
      totalCredit: 0,
    };
    const sourceReference =
      journal.source_type === "expense" && journal.source_id
        ? expenseReferenceById.get(journal.source_id) ?? null
        : null;

    return toJournalRegisterEntry(
      journal,
      periodNameById.get(journal.accounting_period_id) ?? null,
      sourceReference,
      totals,
    );
  });

  const filteredEntries = searchTerm
    ? entries.filter((entry) => matchesSearchTerm(entry, searchTerm))
    : entries;

  filteredEntries.sort(compareJournalEntries);

  const totalCount = filteredEntries.length;
  const offset = (page - 1) * pageSize;
  const pagedEntries = filteredEntries.slice(offset, offset + pageSize);

  return {
    entries: pagedEntries,
    totalCount,
    page,
    pageSize,
  };
}
