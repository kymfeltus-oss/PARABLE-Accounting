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

import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const FORM_PATH = path.join(
  process.cwd(),
  "src/components/vendors/create-vendor-form.tsx",
);

const createdVendor = {
  id: "44444444-4444-4444-8444-444444444444",
  organization_id: TEST_ORGANIZATION_ID,
  name: "Northside Supplies",
  email: "accounts@northside.example.org",
  phone: "555-0100",
  tax_id_last_four: "1234",
  status: "active",
  created_at: "2026-07-21T12:00:00.000Z",
  updated_at: "2026-07-21T12:00:00.000Z",
  hasTaxIdOnFile: true,
  billCount: 0,
  expenseCount: 0,
  openBillCount: 0,
  totalBilledAmount: 0,
  totalExpenseAmount: 0,
  openBillAmount: 0,
};

const { createVendorActionMock } = vi.hoisted(() => ({
  createVendorActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/vendors/actions", () => ({
  createVendorAction: createVendorActionMock,
}));

import {
  CreateVendorForm,
  sanitizeTaxIdLastFour,
} from "./create-vendor-form";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function openCreateVendorForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add Vendor" }));
  expect(screen.getByRole("dialog")).toBeVisible();
}

async function fillCreateVendorForm(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    name: string;
    email?: string;
    phone?: string;
    taxIdLastFour?: string;
  },
) {
  await user.clear(screen.getByLabelText("Vendor name"));
  await user.type(screen.getByLabelText("Vendor name"), values.name);

  if (values.email !== undefined) {
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), values.email);
  }

  if (values.phone !== undefined) {
    await user.clear(screen.getByLabelText("Phone"));
    await user.type(screen.getByLabelText("Phone"), values.phone);
  }

  if (values.taxIdLastFour !== undefined) {
    await user.clear(screen.getByLabelText("Tax ID last four"));
    await user.type(screen.getByLabelText("Tax ID last four"), values.taxIdLastFour);
  }
}

describe("CreateVendorForm", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    createVendorActionMock.mockReset();
    createVendorActionMock.mockResolvedValue({
      ok: true,
      vendor: createdVendor,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the Add Vendor control", () => {
    render(<CreateVendorForm />);

    expect(screen.getByRole("button", { name: "Add Vendor" })).toBeTruthy();
  });

  it("opens the create-vendor sheet when Add Vendor is selected", async () => {
    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);

    expect(
      screen.getByRole("heading", { name: "Add Vendor" }),
    ).toBeTruthy();
  });

  it("renders required fields and labels", async () => {
    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);

    expect(screen.getByLabelText("Vendor name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Phone")).toBeTruthy();
    expect(screen.getByLabelText("Tax ID last four")).toBeTruthy();
  });

  it("uses exact FormData field names on submission", async () => {
    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);
    await fillCreateVendorForm(user, {
      name: "Northside Supplies",
      email: "accounts@northside.example.org",
      phone: "555-0100",
      taxIdLastFour: "1234",
    });
    await user.click(screen.getByRole("button", { name: "Create Vendor" }));

    await waitFor(() => {
      expect(createVendorActionMock).toHaveBeenCalledTimes(1);
    });

    const formData = createVendorActionMock.mock.calls[0]?.[0] as FormData;
    expect(formData.get("name")).toBe("Northside Supplies");
    expect(formData.get("email")).toBe("accounts@northside.example.org");
    expect(formData.get("phone")).toBe("555-0100");
    expect(formData.get("taxIdLastFour")).toBe("1234");
  });

  it("does not include organizationId in the form", () => {
    const contents = readFileSync(FORM_PATH, "utf8");

    expect(contents).not.toMatch(/name=["']organizationId["']/);
    expect(contents).not.toMatch(/name=["']organization_id["']/);
    expect(contents).not.toContain('formData.set("organizationId"');
  });

  it("does not include status in the form", () => {
    const contents = readFileSync(FORM_PATH, "utf8");

    expect(contents).not.toMatch(/name=["']status["']/);
    expect(contents).not.toContain('formData.set("status"');
  });

  it("does not include actor_user_id in the form", () => {
    const contents = readFileSync(FORM_PATH, "utf8");

    expect(contents).not.toMatch(/name=["']actor_user_id["']/);
    expect(contents).not.toContain("actor_user_id");
  });

  it("calls createVendorAction on submission", async () => {
    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);
    await fillCreateVendorForm(user, { name: "Northside Supplies" });
    await user.click(screen.getByRole("button", { name: "Create Vendor" }));

    await waitFor(() => {
      expect(createVendorActionMock).toHaveBeenCalledTimes(1);
    });
  });

  it("disables the submit button while pending", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    createVendorActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);
    await fillCreateVendorForm(user, { name: "Northside Supplies" });
    await user.click(screen.getByRole("button", { name: "Create Vendor" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
    });

    resolveAction({ ok: true, vendor: createdVendor });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add Vendor" })).toBeEnabled();
    });
  });

  it("renders pending text while submission is in progress", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    createVendorActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);
    await fillCreateVendorForm(user, { name: "Northside Supplies" });
    await user.click(screen.getByRole("button", { name: "Create Vendor" }));

    expect(screen.getByRole("button", { name: "Creating..." })).toBeTruthy();

    resolveAction({ ok: true, vendor: createdVendor });
  });

  it("renders safe action errors inline", async () => {
    createVendorActionMock.mockResolvedValue({
      ok: false,
      error:
        "Unable to create vendor. Please verify the information and your access, then try again.",
    });

    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);
    await fillCreateVendorForm(user, { name: "Northside Supplies" });
    await user.click(screen.getByRole("button", { name: "Create Vendor" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to create vendor. Please verify the information and your access, then try again.",
      );
    });
    expect(screen.getByRole("alert").textContent).not.toMatch(
      /postgres|supabase|sqlstate|duplicate key/i,
    );
  });

  it("preserves entered values when submission fails", async () => {
    createVendorActionMock.mockResolvedValue({
      ok: false,
      error:
        "Unable to create vendor. Please verify the information and your access, then try again.",
    });

    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);
    await fillCreateVendorForm(user, {
      name: "Northside Supplies",
      email: "accounts@northside.example.org",
      phone: "555-0100",
      taxIdLastFour: "1234",
    });
    await user.click(screen.getByRole("button", { name: "Create Vendor" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    expect(screen.getByLabelText("Vendor name")).toHaveValue("Northside Supplies");
    expect(screen.getByLabelText("Email")).toHaveValue(
      "accounts@northside.example.org",
    );
    expect(screen.getByLabelText("Phone")).toHaveValue("555-0100");
    expect(screen.getByLabelText("Tax ID last four")).toHaveValue("1234");
  });

  it("shows a success confirmation after a successful submission", async () => {
    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);
    await fillCreateVendorForm(user, { name: "Northside Supplies" });
    await user.click(screen.getByRole("button", { name: "Create Vendor" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        'Vendor "Northside Supplies" created.',
      );
    });
  });

  it("resets the form after a successful submission", async () => {
    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);
    await fillCreateVendorForm(user, {
      name: "Northside Supplies",
      email: "accounts@northside.example.org",
      phone: "555-0100",
      taxIdLastFour: "1234",
    });
    await user.click(screen.getByRole("button", { name: "Create Vendor" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
    });

    await openCreateVendorForm(user);

    expect(screen.getByLabelText("Vendor name")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Phone")).toHaveValue("");
    expect(screen.getByLabelText("Tax ID last four")).toHaveValue("");
  });

  it("closes the sheet after a successful submission", async () => {
    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);
    await fillCreateVendorForm(user, { name: "Northside Supplies" });
    await user.click(screen.getByRole("button", { name: "Create Vendor" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("limits tax ID input to four numeric digits", async () => {
    const user = userEvent.setup();

    render(<CreateVendorForm />);
    await openCreateVendorForm(user);

    const taxIdInput = screen.getByLabelText("Tax ID last four");
    fireEvent.change(taxIdInput, { target: { value: "12ab3456" } });

    expect(taxIdInput).toHaveValue("1234");
    expect(taxIdInput).toHaveAttribute("inputMode", "numeric");
    expect(taxIdInput).toHaveAttribute("maxLength", "4");
  });

  it("sanitizes tax ID values to numeric digits only", () => {
    expect(sanitizeTaxIdLastFour("12ab3456")).toBe("1234");
    expect(sanitizeTaxIdLastFour("abcd")).toBe("");
  });

  it("does not use a direct Supabase call in the Client Component", () => {
    const contents = readFileSync(FORM_PATH, "utf8");

    expect(contents).not.toContain("createBrowserSupabaseClient");
    expect(contents).not.toContain("createClient");
    expect(contents).not.toContain("@/lib/supabase/admin");
    expect(contents).not.toMatch(/supabase\.from\(/);
    expect(contents).not.toMatch(/\.rpc\(/);
  });
});
