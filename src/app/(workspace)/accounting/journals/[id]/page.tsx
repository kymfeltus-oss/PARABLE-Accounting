import { notFound } from "next/navigation";

import { JournalEntryDetail } from "@/components/accounting/journal-entry-detail";
import { getJournalEntryDetail } from "@/lib/data/journal-entry-detail-repository";
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

  return <JournalEntryDetail {...detail} />;
}
