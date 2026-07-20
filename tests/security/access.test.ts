import { describe, expect, it } from "vitest";
import { isTrustedTelegramUser } from "../../src/security/access.js";

describe("isTrustedTelegramUser", () => {
  it("accepts a trusted user ID", () => {
    expect(isTrustedTelegramUser("123", ["123", "456"])).toBe(true);
  });

  it("rejects an unknown user ID", () => {
    expect(isTrustedTelegramUser("999", ["123", "456"])).toBe(false);
  });

  it("rejects a missing user ID", () => {
    expect(isTrustedTelegramUser(undefined, ["123", "456"])).toBe(false);
  });
});
