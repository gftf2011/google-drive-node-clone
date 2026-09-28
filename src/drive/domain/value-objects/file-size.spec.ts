import { InvalidFileSizeError } from "../errors/invalid-file-size.error";

import { FileSize } from "./file-size";

describe("FileSize", () => {
  it("accepts a positive integer number of bytes", () => {
    expect(FileSize.create(1024).bytes).toBe(1024);
  });

  it("rejects zero and negative sizes", () => {
    expect(() => FileSize.create(0)).toThrow(InvalidFileSizeError);
    expect(() => FileSize.create(-1)).toThrow(InvalidFileSizeError);
  });

  it("rejects non-integer sizes", () => {
    expect(() => FileSize.create(1.5)).toThrow(InvalidFileSizeError);
  });

  it("rejects sizes above the 5 TiB object limit", () => {
    const overLimit = 5 * 1024 ** 4 + 1;
    expect(() => FileSize.create(overLimit)).toThrow(InvalidFileSizeError);
  });
});
