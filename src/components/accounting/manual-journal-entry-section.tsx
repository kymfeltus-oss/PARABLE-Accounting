"use client";

import Link from "next/link";
import { useState } from "react";

import { createManualJournalAction } from "@/app/(workspace)/accounting/actions";
import {
  ManualJournalEntryForm,
  type ManualJournalAccountOption,
  type ManualJournalFundOption,
  type ManualJournalPeriodOption,
  type ManualJournalSubmitInput,
  type ManualJournalSubmitResult,
} from "@/components/accounting/manual-journal-entry-form";

export type ManualJournalEntrySectionProps = {
  accounts: ManualJournalAccountOption[];
  funds: ManualJournalFundOption[];
  periods: ManualJournalPeriodOption[];
};

export function ManualJournalEntrySection({
  accounts,
  funds,
  periods,
}: ManualJournalEntrySectionProps) {
  const [createdJournal, setCreatedJournal] = useState<{
    journalEntryId: string;
    entryNumber: string;
  } | null>(null);

  async function handleSubmit(
    input: ManualJournalSubmitInput,
  ): Promise<ManualJournalSubmitResult> {
    return createManualJournalAction(input);
  }

  return (
    <div className="space-y-4">
      <ManualJournalEntryForm
        accounts={accounts}
        funds={funds}
        onCreated={setCreatedJournal}
        onSubmit={handleSubmit}
        periods={periods}
      />

      {createdJournal ? (
        <nav
          aria-label="Manual journal entry next steps"
          className="flex flex-wrap gap-3"
        >
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
            href="/accounting/journals"
          >
            Back to journal register
          </Link>
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href={`/accounting/journals/${createdJournal.journalEntryId}`}
          >
            View journal entry
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
