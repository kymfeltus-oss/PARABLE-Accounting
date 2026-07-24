import { notFound } from "next/navigation";

import { JournalEntryDetail } from "@/components/accounting/journal-entry-detail";
import { JournalReversalSection } from "@/components/accounting/journal-reversal-section";
import { JournalVoidSection } from "@/components/accounting/journal-void-section";
import { getJournalEntryDetail } from "@/lib/data/journal-entry-detail-repository";
import { getJournalReversalEligibility } from "@/lib/data/journal-reversal-repository";
import { getJournalVoidEligibility } from "@/lib/data/journal-void-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

type JournalEntryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function JournalEntryDetailPage({
  params,
}: JournalEntryDetailPageProps) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  const organizationId = await getCurrentOrganizationId();
  const detail = await getJournalEntryDetail(organizationId, id);

  if (!detail) {
    notFound();
  }

  const [reversalEligibility, voidEligibility] = await Promise.all([
    getJournalReversalEligibility(organizationId, id),
    getJournalVoidEligibility(organizationId, id),
  ]);

  const reversalIneligibilityMessage =
    !reversalEligibility.canReverse &&
    reversalEligibility.reason &&
    reversalEligibility.reason !==
      "This journal source type cannot be reversed." &&
    reversalEligibility.reason !== "Journal entry was not found."
      ? reversalEligibility.reason
      : null;

  const voidIneligibilityMessage =
    !voidEligibility.canVoid &&
    voidEligibility.reason &&
    voidEligibility.reason !== "This journal source type cannot be voided." &&
    voidEligibility.reason !== "Journal entry was not found."
      ? voidEligibility.reason
      : null;

  return (
    <div className="space-y-6">
      <JournalEntryDetail {...detail} />

      {reversalEligibility.canReverse ? (
        <JournalReversalSection
          journalEntryId={detail.id}
          originalEntryNumber={detail.entryNumber}
          periods={reversalEligibility.periods}
        />
      ) : reversalIneligibilityMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {reversalIneligibilityMessage}
        </p>
      ) : null}

      {voidEligibility.canVoid ? (
        <JournalVoidSection
          journalEntryId={detail.id}
          originalEntryNumber={detail.entryNumber}
        />
      ) : voidIneligibilityMessage && !reversalEligibility.canReverse ? (
        <p className="text-sm text-muted-foreground" role="status">
          {voidIneligibilityMessage}
        </p>
      ) : null}
    </div>
  );
}
