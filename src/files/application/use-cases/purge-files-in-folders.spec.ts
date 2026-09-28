import { FileMetadata } from "../../domain/aggregates/file-metadata";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { ObjectStorage } from "../ports/storage/object-storage";

import { PurgeFilesInFolders } from "./purge-files-in-folders.use-case";

const ownerId = "11111111-1111-1111-1111-111111111111";
const folderId = "22222222-2222-2222-2222-222222222222";

function file(name: string): FileMetadata {
  return FileMetadata.create({
    ownerId,
    folderId,
    name,
    contentType: "text/plain",
    size: 10,
    storageKey: `uploads/${ownerId}/${name}`,
  });
}

function makeStorage(): ObjectStorage {
  return {
    createMultipartUpload: jest.fn(),
    presignUploadPart: jest.fn(),
    completeMultipartUpload: jest.fn(),
    deleteObjects: jest.fn().mockResolvedValue(undefined),
  };
}

function makeFiles(seed: FileMetadata[]): FileMetadataRepository {
  return {
    save: jest.fn(),
    findByFolderIds: jest.fn().mockResolvedValue(seed),
    deleteByFolderIds: jest.fn().mockResolvedValue(undefined),
  };
}

describe("PurgeFilesInFolders", () => {
  it("deletes the file rows and their storage objects in a single batch", async () => {
    const files = makeFiles([file("a.txt"), file("b.txt")]);
    const storage = makeStorage();
    const useCase = new PurgeFilesInFolders(files, storage);

    await useCase.execute({ folderIds: [folderId] });

    expect(files.deleteByFolderIds).toHaveBeenCalledWith([folderId]);
    expect(storage.deleteObjects).toHaveBeenCalledTimes(1);
    expect(storage.deleteObjects).toHaveBeenCalledWith({
      keys: [`uploads/${ownerId}/a.txt`, `uploads/${ownerId}/b.txt`],
    });
  });

  it("does nothing when there are no folders", async () => {
    const files = makeFiles([]);
    const storage = makeStorage();
    const useCase = new PurgeFilesInFolders(files, storage);

    await useCase.execute({ folderIds: [] });

    expect(files.deleteByFolderIds).not.toHaveBeenCalled();
    expect(storage.deleteObjects).not.toHaveBeenCalled();
  });

  it("does not call the storage when there are no files", async () => {
    const files = makeFiles([]);
    const storage = makeStorage();
    const useCase = new PurgeFilesInFolders(files, storage);

    await useCase.execute({ folderIds: [folderId] });

    expect(files.deleteByFolderIds).toHaveBeenCalledWith([folderId]);
    expect(storage.deleteObjects).not.toHaveBeenCalled();
  });

  it("swallows storage failures (best-effort cleanup)", async () => {
    const files = makeFiles([file("a.txt")]);
    const storage = makeStorage();
    (storage.deleteObjects as jest.Mock).mockRejectedValueOnce(
      new Error("s3 down"),
    );
    const useCase = new PurgeFilesInFolders(files, storage);

    await expect(
      useCase.execute({ folderIds: [folderId] }),
    ).resolves.toBeUndefined();
    expect(files.deleteByFolderIds).toHaveBeenCalled();
  });
});
