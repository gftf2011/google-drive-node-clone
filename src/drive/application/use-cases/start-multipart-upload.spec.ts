import type { Upload } from "../../domain/aggregates/upload";
import { StorageQuotaExceededError } from "../../domain/errors/storage-quota-exceeded.error";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { UploadRepository } from "../../domain/repositories/upload-repository";
import type { ObjectStorage } from "../ports/storage/object-storage";

import { StartMultipartUpload } from "./start-multipart-upload.use-case";

const ownerId = "11111111-1111-1111-1111-111111111111";
const folderId = "22222222-2222-2222-2222-222222222222";
const QUOTA = 15 * 1024 ** 3; // 15 GiB

function makeStorage(): ObjectStorage {
  return {
    createMultipartUpload: jest.fn().mockResolvedValue("s3-upload-id"),
    presignUploadPart: jest
      .fn()
      .mockImplementation(async ({ partNumber }: { partNumber: number }) =>
        `https://storage.test/part/${partNumber}`,
      ),
    completeMultipartUpload: jest.fn(),
    presignDownload: jest.fn(),
    deleteObjects: jest.fn(),
  };
}

function makeUploads(): UploadRepository & { saved: Upload[] } {
  const saved: Upload[] = [];
  return {
    saved,
    findById: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation(async (upload: Upload) => {
      saved.push(upload);
    }),
  };
}

/** File repo whose reported usage is `used` bytes. */
function makeFiles(used: number): FileMetadataRepository {
  return {
    findById: jest.fn(),
    save: jest.fn(),
    sumSizeByOwnerId: jest.fn().mockResolvedValue(used),
    findByFolderId: jest.fn(),
    findByFolderIds: jest.fn(),
    deleteByFolderIds: jest.fn(),
  };
}

describe("StartMultipartUpload", () => {
  it("creates the storage session before persisting, then returns presigned parts", async () => {
    const storage = makeStorage();
    const uploads = makeUploads();
    const useCase = new StartMultipartUpload(
      uploads,
      makeFiles(0),
      storage,
      900,
      QUOTA,
    );

    const output = await useCase.execute({
      ownerId,
      folderId,
      fileName: "movie.mp4",
      contentType: "video/mp4",
      size: 12 * 1024 * 1024,
      partSize: 5 * 1024 * 1024,
    });

    expect(output.uploadId).toBeTruthy();
    expect(output.parts).toHaveLength(3);
    expect(storage.createMultipartUpload).toHaveBeenCalledWith({
      key: output.key,
      contentType: "video/mp4",
    });
  });

  it("persists the upload as pending with the storage id attached", async () => {
    const uploads = makeUploads();
    const useCase = new StartMultipartUpload(
      uploads,
      makeFiles(0),
      makeStorage(),
      900,
      QUOTA,
    );

    await useCase.execute({
      ownerId,
      folderId,
      fileName: "a.txt",
      contentType: "text/plain",
      size: 10,
    });

    expect(uploads.saved).toHaveLength(1);
    expect(uploads.saved[0]!.storageUploadId).toBe("s3-upload-id");
  });

  it("allows an upload that exactly fills the remaining quota", async () => {
    const storage = makeStorage();
    const useCase = new StartMultipartUpload(
      makeUploads(),
      makeFiles(QUOTA - 10),
      storage,
      900,
      QUOTA,
    );

    await useCase.execute({
      ownerId,
      folderId,
      fileName: "a.txt",
      contentType: "text/plain",
      size: 10,
    });

    expect(storage.createMultipartUpload).toHaveBeenCalled();
  });

  it("rejects an upload that would exceed the quota, before touching storage", async () => {
    const storage = makeStorage();
    const useCase = new StartMultipartUpload(
      makeUploads(),
      makeFiles(QUOTA - 5),
      storage,
      900,
      QUOTA,
    );

    await expect(
      useCase.execute({
        ownerId,
        folderId,
        fileName: "a.txt",
        contentType: "text/plain",
        size: 10,
      }),
    ).rejects.toBeInstanceOf(StorageQuotaExceededError);
    expect(storage.createMultipartUpload).not.toHaveBeenCalled();
  });
});
