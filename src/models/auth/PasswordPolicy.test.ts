import { describe, expect, it } from "vitest";
import { passwordProblem, requireStrongPassword } from "./PasswordPolicy";
describe("new password policy", () => {
     it.each([
          "short7",
          "allletterslongenough",
          "12345678901234",
          "Password123456!",
          "P@ssw0rd2026!",
          "Welcome2026!!",
          "admin123456789",
     ])("rejects weak or common password %s", (value) => {
          expect(passwordProblem(value)).toBeTypeOf("string");
          expect(() => requireStrongPassword(value)).toThrow();
     });
     it("accepts long phrases and symbols while enforcing the bcrypt UTF-8 boundary", () => {
          expect(requireStrongPassword("Olive river 29!")).toBe("Olive river 29!");
          expect(passwordProblem("A7" + "é".repeat(36))).toMatch(/72/);
          expect(passwordProblem("A7" + "é".repeat(35))).toBeNull();
     });
});
