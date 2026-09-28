import type { Upload } from "../../domain/aggregates/upload";
import type { UploadRepository } from "../../domain/repositories/upload-repository";
import type { ObjectStorage } from "../ports/storage/object-storage";

import { StartMultipartUpload } from "./start-multipart-upload.use-case";

const ownerId = "11111111-1111-1111-1111-111111111111";
const folderId = "22222222-2222-2222-2222-222222222222";

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

function makeRepository(): UploadRepository & { saved: Upload[] } {
  const saved: Upload[] = [];
  return {
    saved,
    findById: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation(async (upload: Upload) => {
      saved.push(upload);
    }),
  };
}

describe("StartMultipartUpload", () => {
  it("creates the storage session before persisting, then returns presigned parts", async () => {
    const storage = makeStorage();
    const repository = makeRepository();
    const useCase = new StartMultipartUpload(repository, storage, 900);

    const output = await useCase.execute({
      ownerId,
      folderId,
      fileName: "movie.mp4",
      contentType: "video/mp4",
      size: 12 * 1024 * 1024,
      partSize: 5 * 1024 * 1024,
    });

    expect(output.uploadId).toBeTruthy();
    expect(output.expiresInSeconds).toBe(900);
    expect(output.partSize).toBe(5 * 1024 * 1024);
    expect(output.parts).toHaveLength(3);
    expect(output.parts[0]).toEqual({
      partNumber: 1,
      url: "https://storage.test/part/1",
    });

    expect(storage.createMultipartUpload).toHaveBeenCalledWith({
      key: output.key,
      contentType: "video/mp4",
    });
  });

  it("persists the upload as pending with the storage id attached", async () => {
    const storage = makeStorage();
    const repository = makeRepository();
    const useCase = new StartMultipartUpload(repository, storage, 900);

    await useCase.execute({
      ownerId,
      folderId,
      fileName: "a.txt",
      contentType: "text/plain",
      size: 10,
    });

    expect(repository.saved).toHaveLength(1);
    const saved = repository.saved[0]!;
    expect(saved.status).toBe("pending");
    expect(saved.storageUploadId).toBe("s3-upload-id");
  });
});
