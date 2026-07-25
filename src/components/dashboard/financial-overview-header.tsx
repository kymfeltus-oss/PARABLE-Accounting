"use client";

import Link from "next/link";
import {
  Bell,
  BookPlus,
  ChevronDown,
  FileText,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CreateExpenseDraftForm,
  type ExpenseVendorOption,
} from "@/components/expenses/create-expense-draft-form";

export function FinancialOverviewHeader({
  notificationCount,
  vendorOptions,
}: {
  notificationCount: number;
  vendorOptions: ExpenseVendorOption[];
}) {
  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="shrink-0">
        <h1 className="font-heading text-[clamp(1.5rem,5vw,1.875rem)] font-semibold tracking-[-0.035em] text-[#F7FAFF]">
          Financial Overview
        </h1>
        <p className="mt-1 text-sm text-[#AEB9CE]">
          A clear view of your ministry&apos;s financial health.
        </p>
      </div>

      <div className="flex w-full flex-wrap items-center justify-start gap-2.5 sm:justify-end xl:w-auto">
        <details className="group relative w-full sm:w-auto">
          <summary
            className="flex h-12 w-full min-w-0 cursor-pointer list-none items-center justify-start gap-3 rounded-lg border border-[#20324B] bg-[#09111D] px-3 text-sm transition hover:bg-[#0E1726] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]/50 sm:min-w-[12.5rem] sm:w-auto"
            aria-label="Reporting Controls"
          >
            <SlidersHorizontal aria-hidden className="size-5 text-[#AEB9CE]" />
            <span className="flex min-w-0 flex-1 flex-col items-start leading-none">
              <span className="text-xs font-medium text-[#F7FAFF]">
                Reporting Controls
              </span>
              <span className="mt-1 text-[0.62rem] text-[#7E8AA8]">
                Reports&nbsp;&nbsp;•&nbsp;&nbsp;Accounting
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className="size-3.5 text-[#AEB9CE] transition group-open:rotate-180"
            />
          </summary>
          <div className="absolute right-0 top-[calc(100%+.4rem)] z-50 w-56 rounded-md border border-[#20324B] bg-[#0B1220] p-1.5 shadow-2xl">
            <p className="px-2 py-1.5 text-xs font-medium text-[#F7FAFF]">
              Reporting Controls
            </p>
            <div className="my-1 border-t border-white/[0.07]" />
            <Link
              href="/reports"
              className="block rounded px-2 py-2 text-xs text-[#AEB9CE] hover:bg-white/5 hover:text-white"
            >
              Open financial reports
            </Link>
            <Link
              href="/accounting"
              className="block rounded px-2 py-2 text-xs text-[#AEB9CE] hover:bg-white/5 hover:text-white"
            >
              Review accounting period
            </Link>
          </div>
        </details>

        <Button
          asChild
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-11 text-[#AEB9CE] hover:text-white"
        >
          <Link
            href="/exceptions"
            aria-label={`${notificationCount} items need attention`}
          >
            <Bell aria-hidden className="size-5" />
            {notificationCount > 0 ? (
              <span className="absolute right-1 top-0.5 grid min-w-4 place-items-center rounded-full bg-[#1677FF] px-1 text-[0.58rem] leading-4 text-white">
                {Math.min(notificationCount, 99)}
              </span>
            ) : null}
          </Link>
        </Button>

        <Button asChild className="h-11 px-4">
          <Link href="/accounting/journals/new">
            <BookPlus aria-hidden className="size-4" />
            Create journal entry
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          className="h-11 border-[#20324B] bg-[#09111D] px-4 hover:bg-[#0E1726]"
        >
          <Link href="/bills">
            <FileText aria-hidden className="size-4" />
            Bills
          </Link>
        </Button>

        <CreateExpenseDraftForm
          vendorOptions={vendorOptions}
          triggerLabel="Record expense"
          triggerClassName="h-11 px-4"
        />

        <Button
          asChild
          variant="outline"
          className="h-11 border-[#20324B] bg-[#09111D] px-4 hover:bg-[#0E1726]"
        >
          <Link href="/reports">
            <FileText aria-hidden className="size-4" />
            View reports
          </Link>
        </Button>
      </div>
    </header>
  );
}
