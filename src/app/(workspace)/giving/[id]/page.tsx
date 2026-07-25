import { notFound } from "next/navigation";
import type { ComponentProps } from "react";

import { GivingDetailPageContent } from "@/components/giving/giving-detail-page-content";
import { getGivingJournalLinkage } from "@/lib/data/giving-journal-linkage";
import {
  getGivingDebitAccountOptions,
  getGivingRevenueAccountOptions,
} from "@/lib/data/giving-recording-options";
import { getGivingTransactionById } from "@/lib/data/giving-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getOrganizationSettings } from "@/lib/data/organization-settings-repository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

type GivingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export type GivingDetailPagePreparedData = {
  journalLinkage: Awaited<ReturnType<typeof getGivingJournalLinkage>>;
};

type GivingDetailPageViewProps = GivingDetailPagePreparedData &
  ComponentProps<typeof GivingDetailPageContent>;

export function GivingDetailPageView({
  journalLinkage,
  ...contentProps
}: GivingDetailPageViewProps) {
  return (
    <GivingDetailPageContent
      {...contentProps}
      journalLinkage={journalLinkage}
    />
  );
}

export default async function GivingDetailPage({
  params,
}: GivingDetailPageProps) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  const organizationId = await getCurrentOrganizationId();
  const transaction = await getGivingTransactionById(organizationId, id);

  if (!transaction || transaction.status === "void") {
    notFound();
  }

  const isLinkedToJournal = transaction.journal_entry_id != null;
  const canRecordToLedger =
    transaction.status === "recorded" && !isLinkedToJournal;

  const [
    debitAccountOptions,
    revenueAccountOptions,
    journalLinkage,
    organizationSettings,
  ] = await Promise.all([
    canRecordToLedger
      ? getGivingDebitAccountOptions(
          organizationId,
          transaction.giving_method,
        )
      : Promise.resolve([]),
    canRecordToLedger
      ? getGivingRevenueAccountOptions(organizationId)
      : Promise.resolve([]),
    isLinkedToJournal
      ? getGivingJournalLinkage(organizationId, id)
      : Promise.resolve(null),
    canRecordToLedger
      ? getOrganizationSettings(organizationId)
      : Promise.resolve(null),
  ]);

  return (
    <GivingDetailPageView
      debitAccountOptions={debitAccountOptions}
      defaultDebitAccountId={organizationSettings?.default_cash_account_id ?? null}
      defaultRevenueAccountId={
        organizationSettings?.default_revenue_account_id ?? null
      }
      journalLinkage={journalLinkage}
      revenueAccountOptions={revenueAccountOptions}
      transaction={transaction}
    />
  );
}
