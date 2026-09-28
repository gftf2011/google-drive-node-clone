import { FileMetadata } from "../../domain/aggregates/file-metadata";
import { FileAccessDeniedError } from "../../domain/errors/file-access-denied.error";
import { FileNotFoundError } from "../../domain/errors/file-not-found.error";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { ObjectStorage } from "../ports/storage/object-storage";

import { GetFileDownloadUrl } from "./get-file-download-url.use-case";

const ownerId = "11111111-1111-1111-1111-111111111111";
const otherOwnerId = "99999999-9999-9999-9999-999999999999";
const folderId = "22222222-2222-2222-2222-222222222222";

function fileOwnedBy(owner: string): FileMetadata {
  return FileMetadata.create({
    ownerId: owner,
    folderId,
    name: "report.pdf",
    contentType: "application/pdf",
    size: 4096,
    storageKey: "uploads/o/u/report.pdf",
  });
}

function makeStorage(): ObjectStorage {
  return {
    createMultipartUpload: jest.fn(),
    presignUploadPart: jest.fn(),
    presignDownload: jest
      .fn()
      .mockResolvedValue("https://storage.test/download?sig=abc"),
    completeMultipartUpload: jest.fn(),
    deleteObjects: jest.fn(),
  };
}

function makeFiles(seed: FileMetadata | null): FileMetadataRepository {
  return {
    findById: jest.fn().mockResolvedValue(seed),
    save: jest.fn(),
    findByFolderId: jest.fn(),
    findByFolderIds: jest.fn(),
    deleteByFolderIds: jest.fn(),
  };
}

describe("GetFileDownloadUrl", () => {
  it("returns a presigned download url for an owned file", async () => {
    const file = fileOwnedBy(ownerId);
    const storage = makeStorage();
    const useCase = new GetFileDownloadUrl(makeFiles(file), storage, 900);

    const output = await useCase.execute({ fileId: file.id.value, ownerId });

    expect(output.url).toBe("https://storage.test/download?sig=abc");
    expect(output.fileName).toBe("report.pdf");
    expect(output.contentType).toBe("application/pdf");
    expect(output.expiresInSeconds).toBe(900);
    expect(storage.presignDownload).toHaveBeenCalledWith({
      key: file.storageKey.value,
      fileName: "report.pdf",
      contentType: "application/pdf",
      expiresInSeconds: 900,
    });
  });

  it("fails when the file does not exist", async () => {
    const useCase = new GetFileDownloadUrl(makeFiles(null), makeStorage(), 900);
    await expect(
      useCase.execute({
        fileId: "33333333-3333-3333-3333-333333333333",
        ownerId,
      }),
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it("fails when the file belongs to another user", async () => {
    const file = fileOwnedBy(otherOwnerId);
    const useCase = new GetFileDownloadUrl(makeFiles(file), makeStorage(), 900);
    await expect(
      useCase.execute({ fileId: file.id.value, ownerId }),
    ).rejects.toBeInstanceOf(FileAccessDeniedError);
  });
});
