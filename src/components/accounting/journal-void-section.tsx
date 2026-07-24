"use client";

import { voidJournalEntryAction } from "@/app/(workspace)/accounting/actions";
import {
  JournalVoidForm,
  type JournalVoidSubmitInput,
  type JournalVoidSubmitResult,
} from "@/components/accounting/journal-void-form";

export type JournalVoidSectionProps = {
  journalEntryId: string;
  originalEntryNumber: string;
};

export function JournalVoidSection({
  journalEntryId,
  originalEntryNumber,
}: JournalVoidSectionProps) {
  async function handleSubmit(
    input: JournalVoidSubmitInput,
  ): Promise<JournalVoidSubmitResult> {
    return voidJournalEntryAction(input);
  }

  return (
    <JournalVoidForm
      journalEntryId={journalEntryId}
      onSubmit={handleSubmit}
      originalEntryNumber={originalEntryNumber}
    />
  );
}
