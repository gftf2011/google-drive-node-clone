import { FileName } from "./file-name";
import { StorageKey } from "./storage-key";

describe("StorageKey", () => {
  const ownerId = "11111111-1111-1111-1111-111111111111";
  const uploadId = "22222222-2222-2222-2222-222222222222";

  it("builds a key scoped by owner and upload id", () => {
    const key = StorageKey.build({
      ownerId,
      uploadId,
      fileName: FileName.create("report.pdf"),
    });
    expect(key.value).toBe(`uploads/${ownerId}/${uploadId}/report.pdf`);
  });

  it("slugifies unsafe characters in the file name", () => {
    const key = StorageKey.build({
      ownerId,
      uploadId,
      fileName: FileName.create("my résumé (final).pdf"),
    });
    expect(key.value).toBe(
      `uploads/${ownerId}/${uploadId}/my_r_sum_final_.pdf`,
    );
  });

  it("restores an existing key verbatim", () => {
    expect(StorageKey.restore("uploads/a/b/c.txt").value).toBe(
      "uploads/a/b/c.txt",
    );
  });
});
