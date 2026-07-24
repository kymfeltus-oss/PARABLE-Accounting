import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JournalReversalForm } from "./journal-reversal-form";

const PERIOD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOURNAL_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const periods = [
  {
    id: PERIOD_ID,
    name: "July 2026",
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    isOpen: true,
  },
];

afterEach(cleanup);

describe("JournalReversalForm", () => {
  it("submits normalized values and shows the reversal entry number", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      success: true,
      journalEntryId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      entryNumber: "REV-TEST",
    });
    const onCreated = vi.fn();

    render(
      <JournalReversalForm
        journalEntryId={JOURNAL_ID}
        onCreated={onCreated}
        onSubmit={onSubmit}
        originalEntryNumber="MAN-TEST"
        periods={periods}
      />,
    );

    await user.type(screen.getByLabelText("Reversal date"), "2026-07-20");
    await user.type(screen.getByLabelText("Reversal reason"), "Corrected allocation");
    await user.click(screen.getByRole("button", { name: "Reverse journal" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        journalEntryId: JOURNAL_ID,
        reversalDate: "2026-07-20",
        periodId: PERIOD_ID,
        reason: "Corrected allocation",
      });
    });

    expect(await screen.findByText(/REV-TEST/)).toBeVisible();
    expect(onCreated).toHaveBeenCalledWith({
      journalEntryId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      entryNumber: "REV-TEST",
    });
  });

  it("preserves values after a recoverable error and prevents duplicate submits while pending", async () => {
    const user = userEvent.setup();
    let resolveSubmit: ((value: unknown) => void) | null = null;
    const onSubmit = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(
      <JournalReversalForm
        journalEntryId={JOURNAL_ID}
        onSubmit={onSubmit}
        originalEntryNumber="MAN-TEST"
        periods={periods}
      />,
    );

    await user.type(screen.getByLabelText("Reversal date"), "2026-07-20");
    await user.type(screen.getByLabelText("Reversal reason"), "Corrected allocation");

    const submitButton = screen.getByRole("button", { name: "Reverse journal" });
    await user.click(submitButton);
    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);

    resolveSubmit?.({
      success: false,
      message: "The selected accounting period is closed.",
    });

    expect(
      await screen.findByText("The selected accounting period is closed."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Reversal date")).toHaveValue("2026-07-20");
    expect(screen.getByLabelText("Reversal reason")).toHaveValue(
      "Corrected allocation",
    );
  });

  it("does not call Supabase from the browser component", () => {
    const source = [
      require("node:fs").readFileSync(
        require("node:path").resolve(
          process.cwd(),
          "src/components/accounting/journal-reversal-form.tsx",
        ),
        "utf8",
      ),
      require("node:fs").readFileSync(
        require("node:path").resolve(
          process.cwd(),
          "src/components/accounting/journal-reversal-section.tsx",
        ),
        "utf8",
      ),
    ].join("\n");

    expect(source).not.toMatch(/createBrowserSupabaseClient|supabase-js|@\/lib\/supabase\/browser/);
    expect(source).not.toMatch(/\.rpc\(/);
  });
});
