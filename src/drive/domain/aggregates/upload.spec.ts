import { UploadNotPendingError } from "../errors/upload-not-pending.error";

import { Upload } from "./upload";

const ownerId = "11111111-1111-1111-1111-111111111111";
const folderId = "22222222-2222-2222-2222-222222222222";

function openUpload(): Upload {
  return Upload.open({
    ownerId,
    folderId,
    fileName: "video.mp4",
    contentType: "video/mp4",
    size: 1024,
  });
}

describe("Upload", () => {
  it("opens in the pending state with a derived storage key and no storage id", () => {
    const upload = openUpload();
    expect(upload.status).toBe("pending");
    expect(upload.isPending).toBe(true);
    expect(upload.storageUploadId).toBeNull();
    expect(upload.storageKey.value).toBe(
      `uploads/${ownerId}/${upload.id.value}/video.mp4`,
    );
  });

  it("attaches the storage upload id exactly once", () => {
    const upload = openUpload();
    upload.attachStorageUpload("s3-upload-id");
    expect(upload.storageUploadId).toBe("s3-upload-id");

    upload.attachStorageUpload("another-id");
    expect(upload.storageUploadId).toBe("s3-upload-id");
  });

  it("transitions from pending to completed", () => {
    const upload = openUpload();
    upload.attachStorageUpload("s3-upload-id");
    upload.complete();
    expect(upload.status).toBe("completed");
    expect(upload.isPending).toBe(false);
  });

  it("rejects completing an upload that is not pending", () => {
    const upload = openUpload();
    upload.attachStorageUpload("s3-upload-id");
    upload.complete();
    expect(() => upload.complete()).toThrow(UploadNotPendingError);
  });

  it("knows whether it belongs to a given owner", () => {
    const upload = openUpload();
    expect(upload.belongsTo(ownerId)).toBe(true);
    expect(upload.belongsTo("33333333-3333-3333-3333-333333333333")).toBe(false);
  });

  it("restores an existing upload from persistence", () => {
    const restored = Upload.restore({
      id: "44444444-4444-4444-4444-444444444444",
      ownerId,
      folderId,
      fileName: "video.mp4",
      contentType: "video/mp4",
      size: 2048,
      storageKey: "uploads/x/y/video.mp4",
      storageUploadId: "s3-id",
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(restored.status).toBe("completed");
    expect(restored.storageUploadId).toBe("s3-id");
  });
});
