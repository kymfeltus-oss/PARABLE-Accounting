"use client";

import { useRouter } from "next/navigation";

import { recordGivingAction } from "@/app/(workspace)/giving/actions";
import type { GivingRecordingAccountOption } from "@/lib/data/giving-recording-options";

import {
  RecordGivingForm,
  type RecordGivingResult,
  type RecordingAccountOption,
} from "./record-giving-form";

type RecordGivingSectionProps = {
  givingTransactionId: string;
  transactionLabel: string;
  amount: number;
  givingMethod: string;
  debitAccountOptions: GivingRecordingAccountOption[];
  revenueAccountOptions: GivingRecordingAccountOption[];
  defaultDebitAccountId?: string | null;
  defaultRevenueAccountId?: string | null;
};

function mapAccountOptions(
  options: GivingRecordingAccountOption[],
): RecordingAccountOption[] {
  return options.map((option) => ({
    id: option.id,
    code: option.code,
    name: option.name,
    accountType: option.accountType,
  }));
}

export function RecordGivingSection({
  givingTransactionId,
  transactionLabel,
  amount,
  givingMethod,
  debitAccountOptions,
  revenueAccountOptions,
  defaultDebitAccountId = null,
  defaultRevenueAccountId = null,
}: RecordGivingSectionProps) {
  const router = useRouter();

  async function handleRecord(input: {
    givingTransactionId: string;
    debitAccountId: string;
    creditAccountId: string;
  }): Promise<RecordGivingResult> {
    return recordGivingAction(input);
  }

  return (
    <RecordGivingForm
      amount={amount}
      debitAccounts={mapAccountOptions(debitAccountOptions)}
      defaultDebitAccountId={defaultDebitAccountId}
      defaultRevenueAccountId={defaultRevenueAccountId}
      givingMethod={givingMethod}
      givingTransactionId={givingTransactionId}
      revenueAccounts={mapAccountOptions(revenueAccountOptions)}
      transactionLabel={transactionLabel}
      onRecord={handleRecord}
      onRecorded={() => {
        router.refresh();
      }}
    />
  );
}

export type { RecordGivingSectionProps };
