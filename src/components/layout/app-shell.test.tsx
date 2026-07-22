import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { navItems } from "@/config/navigation";

import { AppShell } from "./app-shell";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    usePathnameMock.mockReturnValue("/dashboard");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the desktop sidebar", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(screen.getByText("PARABLE")).toBeInTheDocument();
  });

  it("renders the application header", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders a semantic main landmark", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("assigns id main-content to the main region", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("renders a skip link before the primary shell content", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    const skipLink = screen.getByRole("link", {
      name: "Skip to main content",
    });
    const sidebar = screen.getByRole("complementary");
    const main = screen.getByRole("main");

    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(main).toHaveAttribute("id", "main-content");
    expect(
      skipLink.compareDocumentPosition(sidebar) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders supplied child content inside main", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    const main = screen.getByRole("main");

    expect(within(main).getByText("Workspace child")).toBeInTheDocument();
  });

  it("keeps the mobile drawer closed initially", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the mobile drawer when the Open navigation button is selected", async () => {
    const user = userEvent.setup();

    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("closes the mobile drawer when the sheet close control is selected", async () => {
    const user = userEvent.setup();

    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the mobile drawer when a mobile navigation link is selected", async () => {
    const user = userEvent.setup();

    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    await user.click(screen.getByRole("link", { name: "Giving" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders only one main landmark", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("does not render login, user profile, or fake financial values", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/log in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/logout/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/notifications/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$[\d,]+/)).not.toBeInTheDocument();
  });

  it("does not render navigation links inside the main content region", () => {
    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    const main = screen.getByRole("main");

    expect(within(main).queryAllByRole("link")).toHaveLength(0);
  });

  it("uses centralized navigation through the sidebar and mobile drawer", async () => {
    const user = userEvent.setup();

    render(
      <AppShell>
        <p>Workspace child</p>
      </AppShell>,
    );

    for (const item of navItems) {
      expect(
        within(screen.getByRole("complementary")).getByRole("link", {
          name: item.label,
        }),
      ).toHaveAttribute("href", item.href);
    }

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const dialog = screen.getByRole("dialog");

    for (const item of navItems) {
      expect(
        within(dialog).getByRole("link", { name: item.label }),
      ).toHaveAttribute("href", item.href);
    }
  });
});
