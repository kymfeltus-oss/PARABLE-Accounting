import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GivingRecordingStatus } from "./giving-recording-status";

afterEach(cleanup);

describe("GivingRecordingStatus", () => {
  it("renders the status heading", () => {
    render(<GivingRecordingStatus journalEntryNumber="GIV-123" />);
    expect(screen.getByText("Giving recorded to ledger").tagName).toBe("H2");
  });

  it("renders the journal number when provided", () => {
    render(<GivingRecordingStatus journalEntryNumber="GIV-123" />);
    expect(screen.getByText("Journal entry")).toBeVisible();
    expect(screen.getByText("GIV-123")).toBeVisible();
  });

  it("omits the journal number when absent", () => {
    render(<GivingRecordingStatus journalEntryNumber={null} />);
    expect(screen.queryByText("Journal entry")).not.toBeInTheDocument();
  });

  it("renders a semantic status region", () => {
    render(<GivingRecordingStatus journalEntryNumber="GIV-123" />);
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "Giving recorded to ledger",
    );
  });

  it("contains no repository, action, or routing imports", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/components/giving/giving-recording-status.tsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'][^"']*(repository|actions?)/i);
    expect(source).not.toMatch(/from\s+["']next\/(link|navigation|router)/i);
  });
});
