import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { FileMetadata } from "../../domain/aggregates/file-metadata";
import { Folder } from "../../domain/aggregates/folder";
import { CannotDeleteRootFolderError } from "../../domain/errors/cannot-delete-root-folder.error";
import { FolderAccessDeniedError } from "../../domain/errors/folder-access-denied.error";
import { FolderNotFoundError } from "../../domain/errors/folder-not-found.error";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { FolderRepository } from "../../domain/repositories/folder-repository";
import type { ObjectStorage } from "../ports/storage/object-storage";

import { DeleteFolder } from "./delete-folder.use-case";

const ownerId = "11111111-1111-1111-1111-111111111111";
const otherOwnerId = "99999999-9999-9999-9999-999999999999";

const root = Folder.createRoot({ ownerId });
const a = Folder.create({ name: "A", ownerId, parentId: root.id.value });
const b = Folder.create({ name: "B", ownerId, parentId: a.id.value });
const c = Folder.create({ name: "C", ownerId, parentId: root.id.value });
const tree = [root, a, b, c];

// Runs the transactional work inline, without a real database.
const unitOfWork: UnitOfWork = { runInTransaction: (work) => work() };

function file(name: string, folderId: string): FileMetadata {
  return FileMetadata.create({
    ownerId,
    folderId,
    name,
    contentType: "text/plain",
    size: 10,
    storageKey: `uploads/${ownerId}/${name}`,
  });
}

function makeFolders(target: Folder | null): FolderRepository {
  return {
    existsRootByOwnerId: jest.fn(),
    findById: jest.fn().mockResolvedValue(target),
    findRootByOwnerId: jest.fn(),
    findByOwnerId: jest.fn().mockResolvedValue(tree),
    findChildren: jest.fn(),
    save: jest.fn(),
    deleteByIds: jest.fn().mockResolvedValue(undefined),
  };
}

function makeFiles(seed: FileMetadata[]): FileMetadataRepository {
  return {
    findById: jest.fn(),
    sumSizeByOwnerId: jest.fn(),
    save: jest.fn(),
    findByFolderId: jest.fn(),
    findByFolderIds: jest.fn().mockResolvedValue(seed),
    deleteByFolderIds: jest.fn().mockResolvedValue(undefined),
  };
}

function makeStorage(): ObjectStorage {
  return {
    createMultipartUpload: jest.fn(),
    presignUploadPart: jest.fn(),
    presignDownload: jest.fn(),
    completeMultipartUpload: jest.fn(),
    deleteObjects: jest.fn().mockResolvedValue(undefined),
  };
}

describe("DeleteFolder", () => {
  it("deletes the subtree (folders + files) and purges the storage objects", async () => {
    const folders = makeFolders(a);
    const files = makeFiles([file("x.txt", a.id.value), file("y.txt", b.id.value)]);
    const storage = makeStorage();
    const useCase = new DeleteFolder(folders, files, storage, unitOfWork);

    await useCase.execute({ folderId: a.id.value, ownerId });

    expect(files.deleteByFolderIds).toHaveBeenCalledWith([a.id.value, b.id.value]);
    expect(folders.deleteByIds).toHaveBeenCalledWith([a.id.value, b.id.value]);
    expect(storage.deleteObjects).toHaveBeenCalledWith({
      keys: [`uploads/${ownerId}/x.txt`, `uploads/${ownerId}/y.txt`],
    });
  });

  it("does not touch the storage when the subtree has no files", async () => {
    const storage = makeStorage();
    const useCase = new DeleteFolder(
      makeFolders(a),
      makeFiles([]),
      storage,
      unitOfWork,
    );

    await useCase.execute({ folderId: a.id.value, ownerId });

    expect(storage.deleteObjects).not.toHaveBeenCalled();
  });

  it("fails when the folder does not exist", async () => {
    const useCase = new DeleteFolder(
      makeFolders(null),
      makeFiles([]),
      makeStorage(),
      unitOfWork,
    );
    await expect(
      useCase.execute({
        folderId: "33333333-3333-3333-3333-333333333333",
        ownerId,
      }),
    ).rejects.toBeInstanceOf(FolderNotFoundError);
  });

  it("fails when the folder belongs to another user", async () => {
    const foreign = Folder.create({
      name: "X",
      ownerId: otherOwnerId,
      parentId: root.id.value,
    });
    const useCase = new DeleteFolder(
      makeFolders(foreign),
      makeFiles([]),
      makeStorage(),
      unitOfWork,
    );
    await expect(
      useCase.execute({ folderId: foreign.id.value, ownerId }),
    ).rejects.toBeInstanceOf(FolderAccessDeniedError);
  });

  it("refuses to delete the root folder", async () => {
    const useCase = new DeleteFolder(
      makeFolders(root),
      makeFiles([]),
      makeStorage(),
      unitOfWork,
    );
    await expect(
      useCase.execute({ folderId: root.id.value, ownerId }),
    ).rejects.toBeInstanceOf(CannotDeleteRootFolderError);
  });
});
