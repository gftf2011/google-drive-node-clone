import { InvalidEmailError } from "../errors/invalid-email.error";

import { Email } from "./email";

describe("Email", () => {
  it("normalizes to lowercase and trims", () => {
    expect(Email.create("  User@Example.COM ").value).toBe("user@example.com");
  });

  it("rejects strings that are not a valid email", () => {
    expect(() => Email.create("not-an-email")).toThrow(InvalidEmailError);
    expect(() => Email.create("a@b")).toThrow(InvalidEmailError);
    expect(() => Email.create("a @b.com")).toThrow(InvalidEmailError);
  });

  it("compares by value", () => {
    expect(Email.create("a@b.com").equals(Email.create("A@B.com"))).toBe(true);
  });
});
