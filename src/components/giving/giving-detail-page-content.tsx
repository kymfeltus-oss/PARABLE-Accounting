"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { RecordedExpenseJournalPanel } from "@/components/expenses/recorded-expense-journal-panel";
import { GivingRecordingStatus } from "@/components/giving/giving-recording-status";
import { RecordGivingSection } from "@/components/giving/record-giving-section";
import type { GivingJournalLinkage } from "@/lib/data/giving-journal-linkage";
import type { GivingRecordingAccountOption } from "@/lib/data/giving-recording-options";
import type { GivingTransactionRecord } from "@/lib/data/giving-repository";

export type GivingDetailPageContentProps = {
  transaction: GivingTransactionRecord;
  debitAccountOptions: GivingRecordingAccountOption[];
  revenueAccountOptions: GivingRecordingAccountOption[];
  journalLinkage?: GivingJournalLinkage | null;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMethod(value: string): string {
  return value.replaceAll("_", " ");
}

function buildTransactionLabel(transaction: GivingTransactionRecord): string {
  const reference = transaction.reference?.trim();

  if (reference) {
    return reference;
  }

  return `${formatMethod(transaction.giving_method)} gift`;
}

export function GivingDetailPageContent({
  transaction,
  debitAccountOptions,
  revenueAccountOptions,
  journalLinkage = null,
}: GivingDetailPageContentProps) {
  const isRecorded = transaction.status === "recorded";
  const isLinkedToJournal = transaction.journal_entry_id != null;
  const canRecordToLedger =
    isRecorded &&
    !isLinkedToJournal &&
    Number(transaction.amount) > 0;
  const transactionLabel = buildTransactionLabel(transaction);

  return (
    <section aria-labelledby="giving-detail-title" className="space-y-6">
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/giving"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to giving
        </Link>

        <header className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1
                id="giving-detail-title"
                className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
              >
                {transactionLabel}
              </h1>
              <p className="text-sm capitalize text-muted-foreground">
                {transaction.status.replaceAll("_", " ")}
                {isLinkedToJournal ? " · linked to ledger" : ""}
              </p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-foreground sm:text-right">
              {formatCurrency(Number(transaction.amount))}
            </p>
          </div>
        </header>
      </div>

      <section
        aria-labelledby="giving-detail-fields-title"
        className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
      >
        <h2
          id="giving-detail-fields-title"
          className="text-lg font-semibold text-foreground"
        >
          Giving details
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">Transaction date</dt>
            <dd className="mt-1 text-muted-foreground">
              {formatDate(transaction.transaction_date)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Giving method</dt>
            <dd className="mt-1 capitalize text-muted-foreground">
              {formatMethod(transaction.giving_method)}
            </dd>
          </div>
          {transaction.fundName ? (
            <div>
              <dt className="font-medium text-foreground">Fund</dt>
              <dd className="mt-1 text-muted-foreground">
                {transaction.fundName}
              </dd>
            </div>
          ) : null}
          {transaction.reference ? (
            <div>
              <dt className="font-medium text-foreground">Reference</dt>
              <dd className="mt-1 text-muted-foreground">
                {transaction.reference}
              </dd>
            </div>
          ) : null}
          {transaction.created_at ? (
            <div>
              <dt className="font-medium text-foreground">Created</dt>
              <dd className="mt-1 text-muted-foreground">
                {formatDateTime(transaction.created_at)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {isLinkedToJournal ? (
        <GivingRecordingStatus
          journalEntryNumber={journalLinkage?.entryNumber ?? null}
        />
      ) : null}

      {isLinkedToJournal && journalLinkage ? (
        <RecordedExpenseJournalPanel
          entryDate={formatDate(journalLinkage.entryDate)}
          entryNumber={journalLinkage.entryNumber}
          href={`/accounting/journals/${journalLinkage.journalEntryId}`}
          journalEntryId={journalLinkage.journalEntryId}
          periodName={journalLinkage.periodName}
          sourceReference={journalLinkage.sourceReference}
          status={journalLinkage.status}
          totalCredit={journalLinkage.totalCredit}
          totalDebit={journalLinkage.totalDebit}
        />
      ) : null}

      {canRecordToLedger ? (
        <RecordGivingSection
          amount={Number(transaction.amount)}
          debitAccountOptions={debitAccountOptions}
          givingMethod={transaction.giving_method}
          givingTransactionId={transaction.id}
          revenueAccountOptions={revenueAccountOptions}
          transactionLabel={transactionLabel}
        />
      ) : null}
    </section>
  );
}
