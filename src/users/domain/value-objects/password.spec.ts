import { WeakPasswordError } from "../errors/weak-password.error";

import { Password } from "./password";

describe("Password", () => {
  it("hashes the raw password as salt:hash and never stores plain text", () => {
    const password = Password.create("password123");
    expect(password.hash).toContain(":");
    expect(password.hash).not.toContain("password123");
  });

  it("verifies a matching raw password", () => {
    const password = Password.create("password123");
    expect(password.matches("password123")).toBe(true);
    expect(password.matches("wrong-password")).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(() => Password.create("short")).toThrow(WeakPasswordError);
  });

  it("rehydrates from a stored hash and still verifies", () => {
    const stored = Password.create("password123").hash;
    const rehydrated = Password.fromHash(stored);
    expect(rehydrated.matches("password123")).toBe(true);
  });
});
