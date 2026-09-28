import { FileMetadata } from "../../domain/aggregates/file-metadata";
import { Folder } from "../../domain/aggregates/folder";
import { FolderAccessDeniedError } from "../../domain/errors/folder-access-denied.error";
import { FolderNotFoundError } from "../../domain/errors/folder-not-found.error";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { FolderRepository } from "../../domain/repositories/folder-repository";

import { ListFolderContents } from "./list-folder-contents.use-case";

const ownerId = "11111111-1111-1111-1111-111111111111";
const otherOwnerId = "99999999-9999-9999-9999-999999999999";

const root = Folder.createRoot({ ownerId });
const childFolder = Folder.create({
  name: "Docs",
  ownerId,
  parentId: root.id.value,
});
const childFile = FileMetadata.create({
  ownerId,
  folderId: root.id.value,
  name: "notes.txt",
  contentType: "text/plain",
  size: 20,
  storageKey: `uploads/${ownerId}/notes.txt`,
});

function makeFolders(overrides: Partial<FolderRepository> = {}): FolderRepository {
  return {
    existsRootByOwnerId: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    findRootByOwnerId: jest.fn().mockResolvedValue(root),
    findByOwnerId: jest.fn(),
    findChildren: jest.fn().mockResolvedValue([childFolder]),
    save: jest.fn(),
    deleteByIds: jest.fn(),
    ...overrides,
  };
}

function makeFiles(): FileMetadataRepository {
  return {
    findById: jest.fn(),
    save: jest.fn(),
    findByFolderId: jest.fn().mockResolvedValue([childFile]),
    findByFolderIds: jest.fn(),
    deleteByFolderIds: jest.fn(),
  };
}

describe("ListFolderContents", () => {
  it("lists subfolders and files of the root when no folder is given", async () => {
    const folders = makeFolders();
    const files = makeFiles();
    const useCase = new ListFolderContents(folders, files);

    const output = await useCase.execute({ ownerId, sort: "recent" });

    expect(output.folderId).toBe(root.id.value);
    expect(output.folders.map((f) => f.name)).toEqual(["Docs"]);
    expect(output.files.map((f) => f.name)).toEqual(["notes.txt"]);
    expect(folders.findChildren).toHaveBeenCalledWith(
      root.id.value,
      ownerId,
      "recent",
    );
    expect(files.findByFolderId).toHaveBeenCalledWith(
      root.id.value,
      ownerId,
      "recent",
    );
  });

  it("lists the contents of an explicit folder the user owns", async () => {
    const folders = makeFolders({
      findById: jest.fn().mockResolvedValue(childFolder),
    });
    const files = makeFiles();
    const useCase = new ListFolderContents(folders, files);

    const output = await useCase.execute({
      ownerId,
      folderId: childFolder.id.value,
      sort: "name",
    });

    expect(output.folderId).toBe(childFolder.id.value);
    expect(folders.findChildren).toHaveBeenCalledWith(
      childFolder.id.value,
      ownerId,
      "name",
    );
    expect(files.findByFolderId).toHaveBeenCalledWith(
      childFolder.id.value,
      ownerId,
      "name",
    );
  });

  it("fails when the folder does not exist", async () => {
    const useCase = new ListFolderContents(makeFolders(), makeFiles());
    await expect(
      useCase.execute({
        ownerId,
        folderId: "33333333-3333-3333-3333-333333333333",
        sort: "recent",
      }),
    ).rejects.toBeInstanceOf(FolderNotFoundError);
  });

  it("fails when the folder belongs to another user", async () => {
    const foreign = Folder.create({
      name: "X",
      ownerId: otherOwnerId,
      parentId: root.id.value,
    });
    const useCase = new ListFolderContents(
      makeFolders({ findById: jest.fn().mockResolvedValue(foreign) }),
      makeFiles(),
    );
    await expect(
      useCase.execute({ ownerId, folderId: foreign.id.value, sort: "recent" }),
    ).rejects.toBeInstanceOf(FolderAccessDeniedError);
  });
});
