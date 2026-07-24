"use client";

import Link from "next/link";
import { useState } from "react";

import { reverseJournalEntryAction } from "@/app/(workspace)/accounting/actions";
import {
  JournalReversalForm,
  type JournalReversalPeriodOption,
  type JournalReversalSubmitInput,
  type JournalReversalSubmitResult,
} from "@/components/accounting/journal-reversal-form";

export type JournalReversalSectionProps = {
  journalEntryId: string;
  originalEntryNumber: string;
  periods: JournalReversalPeriodOption[];
};

export function JournalReversalSection({
  journalEntryId,
  originalEntryNumber,
  periods,
}: JournalReversalSectionProps) {
  const [createdJournal, setCreatedJournal] = useState<{
    journalEntryId: string;
    entryNumber: string;
  } | null>(null);

  async function handleSubmit(
    input: JournalReversalSubmitInput,
  ): Promise<JournalReversalSubmitResult> {
    return reverseJournalEntryAction(input);
  }

  return (
    <div className="space-y-4">
      <JournalReversalForm
        journalEntryId={journalEntryId}
        onCreated={setCreatedJournal}
        onSubmit={handleSubmit}
        originalEntryNumber={originalEntryNumber}
        periods={periods}
      />

      {createdJournal ? (
        <nav
          aria-label="Journal reversal next steps"
          className="flex flex-wrap gap-3"
        >
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
            href={`/accounting/journals/${journalEntryId}`}
          >
            View original journal
          </Link>
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href={`/accounting/journals/${createdJournal.journalEntryId}`}
          >
            View reversal {createdJournal.entryNumber}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
