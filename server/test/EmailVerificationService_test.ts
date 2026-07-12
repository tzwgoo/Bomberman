import assert from "assert";

import { AuthError } from "../src/authError.js";
import { normalizeEmail } from "../src/emailVerificationService.js";

describe("email verification", () => {
  it("统一邮箱大小写和首尾空格", () => {
    assert.strictEqual(normalizeEmail("  Player@Example.COM "), "player@example.com");
  });

  it("拒绝无效邮箱", () => {
    assert.throws(() => normalizeEmail("invalid-email"), (error: unknown) => {
      return error instanceof AuthError && error.status === 400;
    });
  });
});
