import { InvalidFileNameError } from "../errors/invalid-file-name.error";

import { FileName } from "./file-name";

describe("FileName", () => {
  it("accepts a plain file name and trims surrounding spaces", () => {
    expect(FileName.create("  report.pdf  ").value).toBe("report.pdf");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(() => FileName.create("   ")).toThrow(InvalidFileNameError);
  });

  it("rejects names containing path separators", () => {
    expect(() => FileName.create("a/b.txt")).toThrow(InvalidFileNameError);
    expect(() => FileName.create("a\\b.txt")).toThrow(InvalidFileNameError);
  });

  it("rejects the dot and dot-dot names", () => {
    expect(() => FileName.create(".")).toThrow(InvalidFileNameError);
    expect(() => FileName.create("..")).toThrow(InvalidFileNameError);
  });

  it("rejects names longer than 255 characters", () => {
    expect(() => FileName.create("a".repeat(256))).toThrow(InvalidFileNameError);
  });
});
