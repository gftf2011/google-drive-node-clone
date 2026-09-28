import { InvalidContentTypeError } from "../errors/invalid-content-type.error";

import { ContentType } from "./content-type";

describe("ContentType", () => {
  it("normalizes to lowercase and trims", () => {
    expect(ContentType.create("  Image/PNG ").value).toBe("image/png");
  });

  it("accepts a valid media type with parameters in the subtype", () => {
    expect(ContentType.create("application/vnd.api+json").value).toBe(
      "application/vnd.api+json",
    );
  });

  it("rejects a string without a type/subtype shape", () => {
    expect(() => ContentType.create("image")).toThrow(InvalidContentTypeError);
    expect(() => ContentType.create("image/")).toThrow(InvalidContentTypeError);
    expect(() => ContentType.create("/png")).toThrow(InvalidContentTypeError);
  });
});
