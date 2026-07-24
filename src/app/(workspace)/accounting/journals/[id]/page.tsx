import { notFound } from "next/navigation";

import { JournalEntryDetail } from "@/components/accounting/journal-entry-detail";
import { JournalReversalSection } from "@/components/accounting/journal-reversal-section";
import { getJournalEntryDetail } from "@/lib/data/journal-entry-detail-repository";
import { getJournalReversalEligibility } from "@/lib/data/journal-reversal-repository";
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

  const eligibility = await getJournalReversalEligibility(organizationId, id);

  return (
    <div className="space-y-6">
      <JournalEntryDetail {...detail} />

      {eligibility.canReverse ? (
        <JournalReversalSection
          journalEntryId={detail.id}
          originalEntryNumber={detail.entryNumber}
          periods={eligibility.periods}
        />
      ) : eligibility.reason &&
        eligibility.reason !== "This journal source type cannot be reversed." &&
        eligibility.reason !== "Journal entry was not found." ? (
        <p className="text-sm text-muted-foreground" role="status">
          {eligibility.reason}
        </p>
      ) : null}
    </div>
  );
}
