import { readFileSync } from "node:fs";
import path from "node:path";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const EDITOR_PATH = path.join(
  process.cwd(),
  "src/components/expenses/expense-allocation-editor.tsx",
);

const TEST_EXPENSE_ID = "55555555-5555-4555-8555-555555555555";
const TEST_ACCOUNT_ID = "44444444-4444-4444-8444-444444444444";
const TEST_ACCOUNT_ID_2 = "66666666-6666-4666-8666-666666666666";
const TEST_FUND_ID = "77777777-7777-4777-8777-777777777777";

const accountOptions = [
  {
    id: TEST_ACCOUNT_ID,
    code: "6100",
    name: "Utilities",
    label: "6100 · Utilities",
  },
  {
    id: TEST_ACCOUNT_ID_2,
    code: "6200",
    name: "Supplies",
    label: "6200 · Supplies",
  },
];

const fundOptions = [
  {
    id: TEST_FUND_ID,
    code: "GEN",
    name: "General Fund",
    label: "GEN · General Fund",
  },
];

const draftExpense = {
  id: TEST_EXPENSE_ID,
  description: "Utility reimbursement draft",
  reference: null,
  totalAmount: 240,
  status: "draft",
  lineCount: 0,
};

const draftExpenseWithLines = {
  ...draftExpense,
  lineCount: 2,
};

const recordedExpense = {
  id: "expense-recorded",
  description: "Office supplies purchase",
  reference: "EXP-1001",
  totalAmount: 125.75,
  status: "recorded",
  lineCount: 2,
};

const voidExpense = {
  id: "expense-void",
  description: "Voided duplicate entry",
  reference: "EXP-0990",
  totalAmount: 50,
  status: "void",
  lineCount: 0,
};

const loadedLines = [
  {
    id: "line-1",
    expenseId: TEST_EXPENSE_ID,
    accountId: TEST_ACCOUNT_ID,
    fundId: TEST_FUND_ID,
    lineNumber: 1,
    description: "First line",
    amount: 100,
  },
  {
    id: "line-2",
    expenseId: TEST_EXPENSE_ID,
    accountId: TEST_ACCOUNT_ID_2,
    fundId: null,
    lineNumber: 2,
    description: null,
    amount: 140,
  },
];

const {
  getExpenseDraftLinesActionMock,
  replaceExpenseDraftLinesActionMock,
} = vi.hoisted(() => ({
  getExpenseDraftLinesActionMock: vi.fn(),
  replaceExpenseDraftLinesActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/expenses/actions", () => ({
  getExpenseDraftLinesAction: getExpenseDraftLinesActionMock,
  replaceExpenseDraftLinesAction: replaceExpenseDraftLinesActionMock,
}));

import {
  ALLOCATION_SHEET_BODY_CLASS,
  ALLOCATION_SHEET_CONTENT_CLASS,
  ALLOCATION_SHEET_FOOTER_CLASS,
  ALLOCATION_SHEET_SCROLL_BODY_CLASS,
  ExpenseAllocationEditor,
  MAX_EXPENSE_ALLOCATION_LINES,
  buildEditableLinesFromDetails,
  normalizeLinesForSave,
  parseAllocationAmount,
  validateEditableLinesForSave,
} from "./expense-allocation-editor";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function openAllocationEditor(
  user: ReturnType<typeof userEvent.setup>,
  triggerName = "Allocate",
) {
  await user.click(screen.getByRole("button", { name: triggerName }));
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeVisible();
  });
}

async function waitForAllocationForm() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Save allocation" })).toBeTruthy();
  });
}

function getLineFieldset(index: number) {
  return screen.getByRole("group", { name: `Line ${index + 1}` });
}

afterEach(() => {
  cleanup();
});

function getAllocationScrollBody(container: ParentNode) {
  return container.querySelector("[data-allocation-sheet-scroll-body]");
}

describe("ExpenseAllocationEditor", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    getExpenseDraftLinesActionMock.mockReset();
    replaceExpenseDraftLinesActionMock.mockReset();
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: [],
    });
    replaceExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      totalAmount: 240,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the Allocate trigger for a draft expense", () => {
    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.getByRole("button", { name: "Allocate" })).toBeTruthy();
  });

  it("does not render an allocation trigger for a recorded expense", () => {
    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={recordedExpense}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.queryByRole("button", { name: "Allocate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit allocation" })).toBeNull();
  });

  it("does not render an allocation trigger for a void expense", () => {
    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={voidExpense}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.queryByRole("button", { name: "Allocate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit allocation" })).toBeNull();
  });

  it("calls getExpenseDraftLinesAction with the exact expense ID when opened", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);

    expect(getExpenseDraftLinesActionMock).toHaveBeenCalledWith({
      expenseId: TEST_EXPENSE_ID,
    });
  });

  it("shows a loading state while allocation lines load", async () => {
    let resolveLoad:
      | ((value: {
          success: true;
          expenseId: string;
          lines: typeof loadedLines;
        }) => void)
      | undefined;

    getExpenseDraftLinesActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Allocate" }));

    expect(screen.getByText("Loading allocation lines...")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save allocation" })).toBeNull();

    resolveLoad?.({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: [],
    });

    await waitForAllocationForm();
  });

  it("does not show the editable form before loading completes", async () => {
    getExpenseDraftLinesActionMock.mockImplementation(
      () => new Promise(() => {}),
    );

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Allocate" }));

    expect(screen.queryByLabelText("Account")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save allocation" })).toBeNull();
  });

  it("prefills loaded lines in authoritative order", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: loadedLines,
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpenseWithLines}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user, "Edit allocation");
    await waitForAllocationForm();

    const firstLine = getLineFieldset(0);
    const secondLine = getLineFieldset(1);

    expect(within(firstLine).getByLabelText("Account")).toHaveValue(
      TEST_ACCOUNT_ID,
    );
    expect(within(firstLine).getByLabelText("Fund")).toHaveValue(TEST_FUND_ID);
    expect(within(firstLine).getByLabelText("Amount")).toHaveValue(100);
    expect(within(firstLine).getByLabelText("Description")).toHaveValue(
      "First line",
    );

    expect(within(secondLine).getByLabelText("Account")).toHaveValue(
      TEST_ACCOUNT_ID_2,
    );
    expect(within(secondLine).getByLabelText("Fund")).toHaveValue("");
    expect(within(secondLine).getByLabelText("Amount")).toHaveValue(140);
  });

  it("initializes one blank row when zero lines are returned", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    expect(screen.getByRole("group", { name: "Line 1" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Line 2" })).toBeNull();
    expect(screen.getByLabelText("Account")).toHaveValue("");
  });

  it("shows the safe load failure message", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: false,
      message: "Unable to load expense allocation. Please try again.",
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);

    expect(
      screen.getByText(
        "Unable to load expense allocation. Please try again.",
      ),
    ).toBeTruthy();
  });

  it("disables Save when loading failed", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: false,
      message: "Unable to load expense allocation. Please try again.",
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);

    expect(screen.queryByRole("button", { name: "Save allocation" })).toBeNull();
  });

  it("retries the read action when Retry is selected", async () => {
    getExpenseDraftLinesActionMock
      .mockResolvedValueOnce({
        success: false,
        message: "Unable to load expense allocation. Please try again.",
      })
      .mockResolvedValueOnce({
        success: true,
        expenseId: TEST_EXPENSE_ID,
        lines: [],
      });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitForAllocationForm();

    expect(getExpenseDraftLinesActionMock).toHaveBeenCalledTimes(2);
  });

  it("renders account options in the account select", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    const options = within(getLineFieldset(0))
      .getByLabelText("Account")
      .querySelectorAll("option");

    expect(Array.from(options).map((option) => option.textContent)).toEqual([
      "Select account",
      "6100 · Utilities",
      "6200 · Supplies",
    ]);
  });

  it("renders fund options in the fund select", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    const options = within(getLineFieldset(0))
      .getByLabelText("Fund")
      .querySelectorAll("option");

    expect(Array.from(options).map((option) => option.textContent)).toEqual([
      "No fund",
      "GEN · General Fund",
    ]);
  });

  it('renders the "No fund" option', async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    expect(
      within(getLineFieldset(0)).getByRole("option", { name: "No fund" }),
    ).toBeTruthy();
  });

  it("appends a row when Add line is selected", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();
    await user.click(screen.getByRole("button", { name: "Add line" }));

    expect(screen.getByRole("group", { name: "Line 2" })).toBeTruthy();
  });

  it("removes the selected row when Remove line is selected", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();
    await user.click(screen.getByRole("button", { name: "Add line" }));
    await user.click(
      screen.getByRole("button", { name: "Remove allocation line 2" }),
    );

    expect(screen.queryByRole("group", { name: "Line 2" })).toBeNull();
  });

  it("keeps at least one visible line row", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    const removeButton = screen.getByRole("button", {
      name: "Remove allocation line 1",
    });

    expect(removeButton).toBeDisabled();
  });

  it("disables Add line at the maximum row count", async () => {
    const maxLines = Array.from({ length: MAX_EXPENSE_ALLOCATION_LINES }, (_, index) => ({
      id: `line-${index + 1}`,
      expenseId: TEST_EXPENSE_ID,
      accountId: TEST_ACCOUNT_ID,
      fundId: null,
      lineNumber: index + 1,
      description: null,
      amount: 1,
    }));

    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: maxLines,
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpenseWithLines}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user, "Edit allocation");
    await waitForAllocationForm();

    expect(screen.getByRole("button", { name: "Add line" })).toBeDisabled();
  });

  it("blocks save when an account is missing", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    expect(
      screen.getByText("Each allocation line requires an account."),
    ).toBeTruthy();
    expect(replaceExpenseDraftLinesActionMock).not.toHaveBeenCalled();
  });

  it("blocks save when amount is zero", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "0" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    expect(
      screen.getByText("Each allocation line requires a valid amount."),
    ).toBeTruthy();
    expect(replaceExpenseDraftLinesActionMock).not.toHaveBeenCalled();
  });

  it("blocks save when amount is negative", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "-10" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    expect(
      screen.getByText("Each allocation line requires a valid amount."),
    ).toBeTruthy();
    expect(replaceExpenseDraftLinesActionMock).not.toHaveBeenCalled();
  });

  it("blocks save when amount has more than two decimal places", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "10.999" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    expect(
      screen.getByText("Each allocation line requires a valid amount."),
    ).toBeTruthy();
    expect(replaceExpenseDraftLinesActionMock).not.toHaveBeenCalled();
  });

  it("trims valid descriptions before save", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  Office supplies  " },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(replaceExpenseDraftLinesActionMock).toHaveBeenCalled();
    });

    expect(replaceExpenseDraftLinesActionMock.mock.calls[0][0].lines[0]).toEqual(
      {
        accountId: TEST_ACCOUNT_ID,
        fundId: null,
        amount: 240,
        description: "Office supplies",
      },
    );
  });

  it("rejects whitespace-only descriptions consistently", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "   " },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    expect(
      screen.getByText("Allocation line descriptions cannot be blank."),
    ).toBeTruthy();
    expect(replaceExpenseDraftLinesActionMock).not.toHaveBeenCalled();
  });

  it("updates the running allocation total as amounts change", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    expect(screen.getByText(/Allocation total:/)).toHaveTextContent("$0.00");

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "125.50" },
    });

    expect(screen.getByText(/Allocation total:/)).toHaveTextContent("$125.50");
  });

  it("updates the difference as amounts change", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    expect(screen.getByText(/Difference:/)).toHaveTextContent("-$240.00");

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "200" },
    });

    expect(screen.getByText(/Difference:/)).toHaveTextContent("-$40.00");
  });

  it("does not block save when allocation total differs from the header total", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "100" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(replaceExpenseDraftLinesActionMock).toHaveBeenCalled();
    });
  });

  it("sends the exact expense ID on save", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(replaceExpenseDraftLinesActionMock).toHaveBeenCalledWith({
        expenseId: TEST_EXPENSE_ID,
        lines: expect.any(Array),
      });
    });
  });

  it("preserves line order on save", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: loadedLines,
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpenseWithLines}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user, "Edit allocation");
    await waitForAllocationForm();
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(replaceExpenseDraftLinesActionMock).toHaveBeenCalled();
    });

    const savedLines = replaceExpenseDraftLinesActionMock.mock.calls[0][0].lines;

    expect(savedLines.map((line: { accountId: string }) => line.accountId)).toEqual(
      [TEST_ACCOUNT_ID, TEST_ACCOUNT_ID_2],
    );
  });

  it("maps an empty fund selection to null on save", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(replaceExpenseDraftLinesActionMock).toHaveBeenCalled();
    });

    expect(
      replaceExpenseDraftLinesActionMock.mock.calls[0][0].lines[0].fundId,
    ).toBeNull();
  });

  it("does not send line numbers on save", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: loadedLines,
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpenseWithLines}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user, "Edit allocation");
    await waitForAllocationForm();
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(replaceExpenseDraftLinesActionMock).toHaveBeenCalled();
    });

    for (const line of replaceExpenseDraftLinesActionMock.mock.calls[0][0].lines) {
      expect(line).not.toHaveProperty("lineNumber");
      expect(line).not.toHaveProperty("line_number");
    }
  });

  it("does not send line IDs on save", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: loadedLines,
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpenseWithLines}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user, "Edit allocation");
    await waitForAllocationForm();
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(replaceExpenseDraftLinesActionMock).toHaveBeenCalled();
    });

    for (const line of replaceExpenseDraftLinesActionMock.mock.calls[0][0].lines) {
      expect(line).not.toHaveProperty("id");
    }
  });

  it("does not send totalAmount on save", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(replaceExpenseDraftLinesActionMock).toHaveBeenCalled();
    });

    expect(replaceExpenseDraftLinesActionMock.mock.calls[0][0]).not.toHaveProperty(
      "totalAmount",
    );
  });

  it("disables duplicate save while a save is pending", async () => {
    let resolveSave:
      | ((value: {
          success: true;
          expenseId: string;
          totalAmount: number;
        }) => void)
      | undefined;

    replaceExpenseDraftLinesActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    resolveSave?.({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      totalAmount: 240,
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Allocation saved\. Authoritative total:/),
      ).toBeTruthy();
    });
  });

  it("shows a success message after save", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(
        screen.getByText(/Allocation saved\. Authoritative total:/),
      ).toBeTruthy();
    });
  });

  it("shows the returned authoritative total after save", async () => {
    replaceExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      totalAmount: 199.5,
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "199.5" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(
        screen.getByText("Allocation saved. Authoritative total: $199.50."),
      ).toBeTruthy();
    });
  });

  it("keeps the form open when save fails", async () => {
    replaceExpenseDraftLinesActionMock.mockResolvedValue({
      success: false,
      message:
        "Unable to update expense allocation. Please verify the information and try again.",
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeVisible();
    });
  });

  it("preserves entered values when save fails", async () => {
    replaceExpenseDraftLinesActionMock.mockResolvedValue({
      success: false,
      message:
        "Unable to update expense allocation. Please verify the information and try again.",
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    await user.selectOptions(screen.getByLabelText("Fund"), TEST_FUND_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Utility charge" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Unable to update expense allocation. Please verify the information and try again.",
        ),
      ).toBeTruthy();
    });

    expect(screen.getByLabelText("Account")).toHaveValue(TEST_ACCOUNT_ID);
    expect(screen.getByLabelText("Fund")).toHaveValue(TEST_FUND_ID);
    expect(screen.getByLabelText("Amount")).toHaveValue(240);
    expect(screen.getByLabelText("Description")).toHaveValue("Utility charge");
  });

  it("shows the safe server message on save failure", async () => {
    replaceExpenseDraftLinesActionMock.mockResolvedValue({
      success: false,
      message:
        "Unable to update expense allocation. Please verify the information and try again.",
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    expect(
      await screen.findByText(
        "Unable to update expense allocation. Please verify the information and try again.",
      ),
    ).toBeTruthy();
  });

  it("does not expose raw database or RPC error text", async () => {
    replaceExpenseDraftLinesActionMock.mockResolvedValue({
      success: false,
      message:
        "Unable to update expense allocation. Please verify the information and try again.",
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    expect(screen.queryByText(/P0001|violates|postgres|rpc/i)).toBeNull();
  });

  it("disables Save when no account options are available", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={[]}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    expect(
      screen.getByText(
        "No eligible active posting expense accounts are available.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save allocation" })).toBeDisabled();
  });

  it("allows a valid no-fund save when fund options are empty", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={[]}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    await user.selectOptions(screen.getByLabelText("Account"), TEST_ACCOUNT_ID);
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "240" },
    });
    await user.click(screen.getByRole("button", { name: "Save allocation" }));

    await waitFor(() => {
      expect(replaceExpenseDraftLinesActionMock).toHaveBeenCalled();
    });
  });

  it("renders an accessible title and description", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);

    expect(
      screen.getByRole("heading", { name: "Expense allocation" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Saving replaces the draft total with the allocation total/),
    ).toBeTruthy();
  });

  it("labels allocation controls accessibly", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);
    await waitForAllocationForm();

    expect(screen.getByLabelText("Account")).toBeTruthy();
    expect(screen.getByLabelText("Fund")).toBeTruthy();
    expect(screen.getByLabelText("Amount")).toBeTruthy();
    expect(screen.getByLabelText("Description")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Remove allocation line 1" }),
    ).toBeTruthy();
  });

  it("does not inspect role on the client", () => {
    const contents = readFileSync(EDITOR_PATH, "utf8");

    expect(contents).not.toMatch(/has_org_role/);
    expect(contents).not.toMatch(/currentUserRole/);
    expect(contents).not.toMatch(/viewer/i);
  });

  it("does not call Supabase directly from the client component", () => {
    const contents = readFileSync(EDITOR_PATH, "utf8");

    expect(contents).not.toContain("createBrowserSupabaseClient");
    expect(contents).not.toContain("createServerSupabaseClient");
    expect(contents).not.toContain("@/lib/supabase/admin");
    expect(contents).not.toContain("@/lib/data/expenses-repository");
  });

  it("does not expose record, post, void, approve, pay, or journal controls", () => {
    const contents = readFileSync(EDITOR_PATH, "utf8");

    expect(contents).not.toMatch(/\bRecord expense\b/i);
    expect(contents).not.toMatch(/\bPost\b/);
    expect(contents).not.toMatch(/\bVoid\b/);
    expect(contents).not.toMatch(/\bApprove\b/);
    expect(contents).not.toMatch(/\bPay\b/);
    expect(contents).not.toMatch(/journal/i);
  });

  it("uses a viewport-constrained Sheet layout", () => {
    const contents = readFileSync(EDITOR_PATH, "utf8");

    expect(contents).toContain("ALLOCATION_SHEET_CONTENT_CLASS");
    expect(ALLOCATION_SHEET_CONTENT_CLASS).toContain("h-dvh");
    expect(ALLOCATION_SHEET_CONTENT_CLASS).toContain("max-h-dvh");
    expect(ALLOCATION_SHEET_CONTENT_CLASS).toContain("flex-col");
    expect(ALLOCATION_SHEET_CONTENT_CLASS).toContain("overflow-hidden");
    expect(ALLOCATION_SHEET_CONTENT_CLASS).toContain(
      "data-[side=right]:h-dvh",
    );
    expect(ALLOCATION_SHEET_CONTENT_CLASS).toContain(
      "data-[side=right]:max-h-dvh",
    );
  });

  it("uses a flex-column body wrapper between header and states", () => {
    const contents = readFileSync(EDITOR_PATH, "utf8");

    expect(contents).toContain("ALLOCATION_SHEET_BODY_CLASS");
    expect(ALLOCATION_SHEET_BODY_CLASS).toContain("flex");
    expect(ALLOCATION_SHEET_BODY_CLASS).toContain("flex-col");
    expect(ALLOCATION_SHEET_BODY_CLASS).toContain("min-h-0");
    expect(ALLOCATION_SHEET_BODY_CLASS).toContain("flex-1");
    expect(ALLOCATION_SHEET_BODY_CLASS).toContain("overflow-hidden");
  });

  it("uses a vertically scrollable editable body", () => {
    const contents = readFileSync(EDITOR_PATH, "utf8");

    expect(contents).toContain("ALLOCATION_SHEET_SCROLL_BODY_CLASS");
    expect(ALLOCATION_SHEET_SCROLL_BODY_CLASS).toContain("min-h-0");
    expect(ALLOCATION_SHEET_SCROLL_BODY_CLASS).toContain("overflow-y-auto");
    expect(contents).toContain("data-allocation-sheet-scroll-body");
    expect(contents).toContain("SheetFooter");
    expect(ALLOCATION_SHEET_FOOTER_CLASS).toContain("shrink-0");
    expect(ALLOCATION_SHEET_FOOTER_CLASS).toContain("mt-0");
  });

  it("keeps Save allocation rendered in populated state", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: loadedLines,
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpenseWithLines}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user, "Edit allocation");
    await waitForAllocationForm();

    expect(
      screen.getByRole("button", { name: "Save allocation" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Line 2" }),
    ).toBeTruthy();
  });

  it("keeps Save allocation reachable outside the scroll body", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: loadedLines,
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpenseWithLines}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user, "Edit allocation");
    await waitForAllocationForm();

    const dialog = screen.getByRole("dialog");
    const saveButton = within(dialog).getByRole("button", {
      name: "Save allocation",
    });
    const scrollBody = getAllocationScrollBody(dialog);

    expect(saveButton).toBeTruthy();
    expect(scrollBody).toBeTruthy();
    expect(scrollBody?.contains(saveButton)).toBe(false);
    expect(
      within(dialog).getByRole("group", { name: "Line 2" }),
    ).toBeTruthy();
  });

  it("renders the loading state inside the scroll layout", async () => {
    getExpenseDraftLinesActionMock.mockImplementation(
      () => new Promise(() => {}),
    );

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Allocate" }));

    const dialog = screen.getByRole("dialog");

    expect(screen.getByText("Loading allocation lines...")).toBeTruthy();
    expect(getAllocationScrollBody(dialog)).toBeTruthy();
  });

  it("renders the load-error state inside the scroll layout", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: false,
      message: "Unable to load expense allocation. Please try again.",
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpense}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user);

    const dialog = screen.getByRole("dialog");

    expect(
      screen.getByText("Unable to load expense allocation. Please try again."),
    ).toBeTruthy();
    expect(getAllocationScrollBody(dialog)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("renders populated multi-line state inside the scroll layout", async () => {
    getExpenseDraftLinesActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: loadedLines,
    });

    const user = userEvent.setup();

    render(
      <ExpenseAllocationEditor
        accountOptions={accountOptions}
        expense={draftExpenseWithLines}
        fundOptions={fundOptions}
      />,
    );

    await openAllocationEditor(user, "Edit allocation");
    await waitForAllocationForm();

    const dialog = screen.getByRole("dialog");
    const scrollBody = getAllocationScrollBody(dialog);

    expect(scrollBody).toBeTruthy();
    expect(
      within(dialog).getByRole("group", { name: "Line 1" }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("group", { name: "Line 2" }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "Save allocation" }),
    ).toBeTruthy();
    expect(scrollBody?.contains(
      within(dialog).getByRole("group", { name: "Line 2" }),
    )).toBe(true);
  });

  it("uses helper validation for amount parsing edge cases", () => {
    expect(parseAllocationAmount("10.50")).toBe(10.5);
    expect(parseAllocationAmount("0")).toBeNull();
    expect(parseAllocationAmount("-1")).toBeNull();
    expect(parseAllocationAmount("1.234")).toBeNull();
    expect(validateEditableLinesForSave(buildEditableLinesFromDetails([]))).toBe(
      "Each allocation line requires an account.",
    );
    expect(
      normalizeLinesForSave([
        {
          clientKey: "line-1",
          accountId: TEST_ACCOUNT_ID,
          fundId: "",
          amount: "10",
          description: "",
        },
      ])[0],
    ).toEqual({
      accountId: TEST_ACCOUNT_ID,
      fundId: null,
      amount: 10,
      description: null,
    });
  });
});
