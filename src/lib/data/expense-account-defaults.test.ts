import { describe, expect, it } from "vitest";

import {
  resolveDefaultExpenseAccountId,
  resolveDefaultExpenseCreditAccountId,
} from "./expense-account-defaults";

describe("expense account defaults", () => {
  it("prefers expense codes 5000 then 6000", () => {
    expect(
      resolveDefaultExpenseAccountId([
        { id: "e6", code: "6000" },
        { id: "e5", code: "5000" },
        { id: "e7", code: "7000" },
      ]),
    ).toBe("e5");
  });

  it("uses org cash default for bank/cash payment credits when eligible", () => {
    expect(
      resolveDefaultExpenseCreditAccountId(
        [
          { id: "cash-default", code: "1000" },
          { id: "other-cash", code: "1010" },
        ],
        "bank",
        "cash-default",
      ),
    ).toBe("cash-default");
  });

  it("suggests liability codes for card payments", () => {
    expect(
      resolveDefaultExpenseCreditAccountId(
        [
          { id: "ap", code: "2000" },
          { id: "card", code: "2100" },
        ],
        "card",
        "cash-default",
      ),
    ).toBe("card");
  });
});
