import { readFileSync } from "node:fs";
import path from "node:path";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FORM_PATH = path.join(
  process.cwd(),
  "src/components/expenses/create-expense-draft-form.tsx",
);

const TEST_VENDOR_ID = "44444444-4444-4444-8444-444444444444";
const TEST_EXPENSE_ID = "55555555-5555-4555-8555-555555555555";

const vendorOptions = [
  { id: TEST_VENDOR_ID, name: "Northside Supplies" },
  { id: "66666666-6666-4666-8666-666666666666", name: "City Utilities" },
];

const { createExpenseDraftActionMock } = vi.hoisted(() => ({
  createExpenseDraftActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/expenses/actions", () => ({
  createExpenseDraftAction: createExpenseDraftActionMock,
}));

import {
  CreateExpenseDraftForm,
  mapVendorSelection,
  normalizeReference,
  parseTotalAmount,
  PAYMENT_SOURCE_OPTIONS,
} from "./create-expense-draft-form";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function openCreateExpenseForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "New Expense" }));
  expect(screen.getByRole("dialog")).toBeVisible();
}

async function fillCreateExpenseForm(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    expenseDate: string;
    description: string;
    totalAmount: string;
    paymentSource?: string;
    vendorId?: string;
    reference?: string;
  },
) {
  await user.clear(screen.getByLabelText("Expense date"));
  fireEvent.change(screen.getByLabelText("Expense date"), {
    target: { value: values.expenseDate },
  });
  await user.clear(screen.getByLabelText("Description"));
  await user.type(screen.getByLabelText("Description"), values.description);
  await user.clear(screen.getByLabelText("Total amount"));
  await user.type(screen.getByLabelText("Total amount"), values.totalAmount);

  if (values.paymentSource !== undefined) {
    await user.selectOptions(
      screen.getByLabelText("Payment source"),
      values.paymentSource,
    );
  }

  if (values.vendorId !== undefined) {
    await user.selectOptions(screen.getByLabelText("Vendor"), values.vendorId);
  }

  if (values.reference !== undefined) {
    fireEvent.change(screen.getByLabelText("Reference"), {
      target: { value: values.reference },
    });
  }
}

describe("CreateExpenseDraftForm", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    createExpenseDraftActionMock.mockReset();
    createExpenseDraftActionMock.mockResolvedValue({
      success: true,
      expenseId: TEST_EXPENSE_ID,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the "New Expense" trigger', () => {
    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);

    expect(screen.getByRole("button", { name: "New Expense" })).toBeTruthy();
  });

  it("opens the create-expense sheet when New Expense is selected", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);

    expect(
      screen.getByRole("heading", { name: "New Expense" }),
    ).toBeTruthy();
  });

  it("renders required fields and labels", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);

    expect(screen.getByLabelText("Expense date")).toBeTruthy();
    expect(screen.getByLabelText("Description")).toBeTruthy();
    expect(screen.getByLabelText("Total amount")).toBeTruthy();
    expect(screen.getByLabelText("Payment source")).toBeTruthy();
  });

  it("renders optional vendor and reference fields", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);

    expect(screen.getByLabelText("Vendor")).toBeTruthy();
    expect(screen.getByLabelText("Reference")).toBeTruthy();
  });

  it("renders the exact payment-source options", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);

    for (const option of PAYMENT_SOURCE_OPTIONS) {
      expect(screen.getByRole("option", { name: option.label })).toHaveValue(
        option.value,
      );
    }
  });

  it("renders vendor options from supplied vendor data", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);

    expect(screen.getByRole("option", { name: "No vendor" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Northside Supplies" })).toHaveValue(
      TEST_VENDOR_ID,
    );
    expect(screen.getByRole("option", { name: "City Utilities" })).toBeTruthy();
  });

  it("uses a vendor select instead of a free-text vendor ID input", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);

    expect(screen.getByLabelText("Vendor").tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "No vendor" })).toBeTruthy();
  });

  it("does not include status in the form", () => {
    const contents = readFileSync(FORM_PATH, "utf8");

    expect(contents).not.toMatch(/name=["']status["']/);
  });

  it("does not include line, account, fund, or journal fields", () => {
    const contents = readFileSync(FORM_PATH, "utf8");

    expect(contents).not.toMatch(/name=["']account/i);
    expect(contents).not.toMatch(/name=["']fund/i);
    expect(contents).not.toMatch(/journal_entry/i);
    expect(contents).not.toMatch(/expenseLines/i);
    expect(contents).not.toMatch(/name=["']line/i);
  });

  it("rejects blank required fields before calling the action", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Expense date is required.",
      );
    });
    expect(createExpenseDraftActionMock).not.toHaveBeenCalled();
  });

  it("converts total amount to a number for the action call", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "125.75",
      paymentSource: "card",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(createExpenseDraftActionMock).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 125.75 }),
      );
    });
  });

  it("maps no vendor selection to null", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "50",
      paymentSource: "cash",
      vendorId: "",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(createExpenseDraftActionMock).toHaveBeenCalledWith(
        expect.objectContaining({ vendorId: null }),
      );
    });
  });

  it("forwards the selected vendor ID", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "50",
      paymentSource: "bank",
      vendorId: TEST_VENDOR_ID,
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(createExpenseDraftActionMock).toHaveBeenCalledWith(
        expect.objectContaining({ vendorId: TEST_VENDOR_ID }),
      );
    });
  });

  it("maps blank reference to null", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "50",
      paymentSource: "other",
      reference: "",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(createExpenseDraftActionMock).toHaveBeenCalledWith(
        expect.objectContaining({ reference: null }),
      );
    });
  });

  it("forwards a trimmed reference value", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "50",
      paymentSource: "other",
      reference: "  EXP-2001  ",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(createExpenseDraftActionMock).toHaveBeenCalledWith({
        expenseDate: "2026-07-20",
        description: "Office supplies",
        totalAmount: 50,
        vendorId: null,
        reference: "EXP-2001",
        paymentSource: "other",
      });
    });
  });

  it("calls createExpenseDraftAction with the exact expected shape", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "125.75",
      paymentSource: "card",
      vendorId: TEST_VENDOR_ID,
      reference: "EXP-2001",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(createExpenseDraftActionMock).toHaveBeenCalledWith({
        expenseDate: "2026-07-20",
        description: "Office supplies",
        totalAmount: 125.75,
        vendorId: TEST_VENDOR_ID,
        reference: "EXP-2001",
        paymentSource: "card",
      });
    });
  });

  it("disables the submit button while pending", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    createExpenseDraftActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "50",
      paymentSource: "cash",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
    });

    resolveAction({ success: true, expenseId: TEST_EXPENSE_ID });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Expense" })).toBeEnabled();
    });
  });

  it("shows success feedback and closes the sheet after a successful submission", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "50",
      paymentSource: "cash",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        'Draft expense "Office supplies" created.',
      );
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("resets the form after a successful submission", async () => {
    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "50",
      paymentSource: "cash",
      vendorId: TEST_VENDOR_ID,
      reference: "EXP-2001",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
    });

    await openCreateExpenseForm(user);

    expect(screen.getByLabelText("Expense date")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
    expect(screen.getByLabelText("Total amount")).toHaveValue(null);
    expect(screen.getByLabelText("Vendor")).toHaveValue("");
    expect(screen.getByLabelText("Reference")).toHaveValue("");
  });

  it("renders safe action errors inline", async () => {
    createExpenseDraftActionMock.mockResolvedValue({
      success: false,
      message:
        "Unable to create expense draft. Please verify the information and try again.",
    });

    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "50",
      paymentSource: "cash",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to create expense draft. Please verify the information and try again.",
      );
    });
    expect(screen.getByRole("alert").textContent).not.toMatch(
      /postgres|supabase|sqlstate|insufficient role/i,
    );
  });

  it("preserves entered values when submission fails", async () => {
    createExpenseDraftActionMock.mockResolvedValue({
      success: false,
      message:
        "Unable to create expense draft. Please verify the information and try again.",
    });

    const user = userEvent.setup();

    render(<CreateExpenseDraftForm vendorOptions={vendorOptions} />);
    await openCreateExpenseForm(user);
    await fillCreateExpenseForm(user, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: "125.75",
      paymentSource: "card",
      vendorId: TEST_VENDOR_ID,
      reference: "EXP-2001",
    });
    await user.click(screen.getByRole("button", { name: "Create Draft Expense" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    expect(screen.getByLabelText("Expense date")).toHaveValue("2026-07-20");
    expect(screen.getByLabelText("Description")).toHaveValue("Office supplies");
    expect(screen.getByLabelText("Total amount")).toHaveValue(125.75);
    expect(screen.getByLabelText("Vendor")).toHaveValue(TEST_VENDOR_ID);
    expect(screen.getByLabelText("Reference")).toHaveValue("EXP-2001");
  });

  it("does not use a direct Supabase call in the Client Component", () => {
    const contents = readFileSync(FORM_PATH, "utf8");

    expect(contents).not.toContain("createBrowserSupabaseClient");
    expect(contents).not.toContain("createClient");
    expect(contents).not.toContain("@/lib/supabase/admin");
    expect(contents).not.toMatch(/supabase\.from\(/);
    expect(contents).not.toMatch(/\.rpc\(/);
  });

  it("parses positive decimal totals", () => {
    expect(parseTotalAmount("125.75")).toBe(125.75);
    expect(parseTotalAmount("0")).toBeNull();
    expect(parseTotalAmount("-1")).toBeNull();
    expect(parseTotalAmount("abc")).toBeNull();
  });

  it("maps vendor and reference helpers", () => {
    expect(mapVendorSelection("")).toBeNull();
    expect(mapVendorSelection(TEST_VENDOR_ID)).toBe(TEST_VENDOR_ID);
    expect(normalizeReference("")).toBeNull();
    expect(normalizeReference("  EXP-1  ")).toBe("EXP-1");
  });
});
