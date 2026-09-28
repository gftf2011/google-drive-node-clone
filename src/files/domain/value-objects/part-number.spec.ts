import { InvalidPartNumberError } from "../errors/invalid-part-number.error";

import { PartNumber } from "./part-number";

describe("PartNumber", () => {
  it("accepts the boundary values 1 and 10000", () => {
    expect(PartNumber.create(1).value).toBe(1);
    expect(PartNumber.create(10_000).value).toBe(10_000);
  });

  it("rejects values below 1", () => {
    expect(() => PartNumber.create(0)).toThrow(InvalidPartNumberError);
  });

  it("rejects values above 10000", () => {
    expect(() => PartNumber.create(10_001)).toThrow(InvalidPartNumberError);
  });

  it("rejects non-integers", () => {
    expect(() => PartNumber.create(1.2)).toThrow(InvalidPartNumberError);
  });
});
