import Link from "next/link";
import { BookPlus } from "lucide-react";

import { JournalRegisterSection } from "@/components/accounting/journal-register-section";
import type { JournalRegisterRow } from "@/components/accounting/journal-register-table";
import { Button } from "@/components/ui/button";
import {
  getJournalRegister,
  normalizeJournalRegisterSource,
  normalizeJournalRegisterStatus,
  type JournalRegisterEntry,
} from "@/lib/data/journal-register-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

type JournalRegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseOptionalInteger(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function toJournalRegisterRow(entry: JournalRegisterEntry): JournalRegisterRow {
  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    entryDate: entry.entryDate,
    description: entry.description,
    source: entry.source,
    sourceReference: entry.sourceReference,
    periodName: entry.periodName,
    status: entry.status,
    totalDebit: entry.totalDebit,
    totalCredit: entry.totalCredit,
  };
}

export default async function JournalRegisterPage({
  searchParams,
}: JournalRegisterPageProps) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  const search = readSearchParam(params.search).trim();
  const status = normalizeJournalRegisterStatus(readSearchParam(params.status));
  const source = normalizeJournalRegisterSource(readSearchParam(params.source));
  const page = parseOptionalInteger(readSearchParam(params.page));
  const pageSize = parseOptionalInteger(readSearchParam(params.pageSize));

  const result = await getJournalRegister(organizationId, {
    search: search || undefined,
    status,
    source,
    page,
    pageSize,
  });

  return (
    <section aria-labelledby="journal-register-page-title" className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1
              className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
              id="journal-register-page-title"
            >
              Journal register
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Review organization journal entries, filter by status or source, and
              inspect debit and credit totals for each entry.
            </p>
          </div>
          <Button asChild type="button">
            <Link href="/accounting/journals/new">
              <BookPlus aria-hidden className="size-4" />
              Create journal entry
            </Link>
          </Button>
        </div>
      </header>

      <JournalRegisterSection
        filters={{
          search,
          source,
          status,
        }}
        page={result.page}
        pageSize={result.pageSize}
        rows={result.entries.map(toJournalRegisterRow)}
        totalCount={result.totalCount}
      />
    </section>
  );
}
