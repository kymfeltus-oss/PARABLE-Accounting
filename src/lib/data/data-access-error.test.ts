import { describe, expect, it } from "vitest";

import { DataAccessError } from "./data-access-error";

describe("DataAccessError", () => {
  it("stores operation, message, and cause", () => {
    const cause = new Error("database unavailable");
    const error = new DataAccessError({
      operation: "getMembersData.members",
      message: "database unavailable",
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DataAccessError);
    expect(error.name).toBe("DataAccessError");
    expect(error.operation).toBe("getMembersData.members");
    expect(error.message).toBe("database unavailable");
    expect(error.cause).toBe(cause);
  });
});
