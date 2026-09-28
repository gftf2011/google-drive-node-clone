import { FileMetadata } from "./file-metadata";

const ownerId = "11111111-1111-1111-1111-111111111111";
const folderId = "22222222-2222-2222-2222-222222222222";

describe("FileMetadata", () => {
  it("creates a file associated with a folder and a storage object", () => {
    const file = FileMetadata.create({
      ownerId,
      folderId,
      name: "photo.jpg",
      contentType: "image/jpeg",
      size: 4096,
      storageKey: "uploads/a/b/photo.jpg",
    });
    expect(file.id.value).toBeTruthy();
    expect(file.ownerId.value).toBe(ownerId);
    expect(file.folderId.value).toBe(folderId);
    expect(file.name.value).toBe("photo.jpg");
    expect(file.storageKey.value).toBe("uploads/a/b/photo.jpg");
  });

  it("restores an existing file from persistence", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const file = FileMetadata.restore({
      id: "33333333-3333-3333-3333-333333333333",
      ownerId,
      folderId,
      name: "photo.jpg",
      contentType: "image/jpeg",
      size: 4096,
      storageKey: "uploads/a/b/photo.jpg",
      createdAt,
      updatedAt: createdAt,
    });
    expect(file.id.value).toBe("33333333-3333-3333-3333-333333333333");
    expect(file.createdAt).toEqual(createdAt);
  });
});
