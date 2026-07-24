import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JournalVoidForm } from "./journal-void-form";

afterEach(() => {
  cleanup();
});

describe("JournalVoidForm", () => {
  it("requires a void reason before submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <JournalVoidForm
        journalEntryId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
        onSubmit={onSubmit}
        originalEntryNumber="MAN-TEST"
      />,
    );

    expect(screen.getByRole("button", { name: "Void Journal" })).toBeDisabled();

    await user.type(screen.getByLabelText("Void reason"), "Duplicate entry");
    expect(screen.getByRole("button", { name: "Void Journal" })).toBeEnabled();
  });

  it("submits journalEntryId and reason", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      success: true,
      journalEntryId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      entryNumber: "MAN-TEST",
    });

    const { container } = render(
      <JournalVoidForm
        journalEntryId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
        onSubmit={onSubmit}
        originalEntryNumber="MAN-TEST"
      />,
    );
    const view = within(container);

    await user.type(view.getByLabelText("Void reason"), "Duplicate entry");
    await user.click(view.getByRole("button", { name: "Void Journal" }));

    expect(onSubmit).toHaveBeenCalledWith({
      journalEntryId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      reason: "Duplicate entry",
    });
    expect(view.getByRole("status")).toHaveTextContent("Journal voided");
  });

  it("shows error messages from failed submits", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      message: "Only posted journal entries can be voided.",
    });

    const { container } = render(
      <JournalVoidForm
        journalEntryId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
        onSubmit={onSubmit}
        originalEntryNumber="MAN-TEST"
      />,
    );
    const view = within(container);

    await user.type(view.getByLabelText("Void reason"), "Duplicate entry");
    await user.click(view.getByRole("button", { name: "Void Journal" }));

    expect(view.getByRole("alert")).toHaveTextContent(
      "Only posted journal entries can be voided.",
    );
  });
});
