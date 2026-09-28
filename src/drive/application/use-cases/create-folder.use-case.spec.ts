import { Folder } from "../../domain/aggregates/folder";
import { FolderAccessDeniedError } from "../../domain/errors/folder-access-denied.error";
import { ParentFolderNotFoundError } from "../../domain/errors/parent-folder-not-found.error";
import type { FolderRepository } from "../../domain/repositories/folder-repository";

import { CreateFolder } from "./create-folder.use-case";

const ownerId = "11111111-1111-1111-1111-111111111111";
const otherOwnerId = "99999999-9999-9999-9999-999999999999";
const grandParentId = "22222222-2222-2222-2222-222222222222";

function makeRepository(
  overrides: Partial<FolderRepository> = {},
): FolderRepository & { saved: Folder[] } {
  const saved: Folder[] = [];
  return {
    saved,
    existsRootByOwnerId: jest.fn().mockResolvedValue(true),
    findById: jest.fn().mockResolvedValue(null),
    findRootByOwnerId: jest.fn().mockResolvedValue(null),
    findByOwnerId: jest.fn().mockResolvedValue([]),
    findChildren: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (folder: Folder) => {
      saved.push(folder);
    }),
    deleteByIds: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("CreateFolder", () => {
  it("creates a subfolder under the user's root when no parent is given", async () => {
    const root = Folder.createRoot({ ownerId });
    const repository = makeRepository({
      findRootByOwnerId: jest.fn().mockResolvedValue(root),
    });
    const useCase = new CreateFolder(repository);

    const output = await useCase.execute({ ownerId, name: "Documents" });

    expect(output.name).toBe("Documents");
    expect(output.parentId).toBe(root.id.value);
    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0]!.parentId?.value).toBe(root.id.value);
  });

  it("creates a subfolder under an explicit parent the user owns", async () => {
    const parent = Folder.create({
      name: "Work",
      ownerId,
      parentId: grandParentId,
    });
    const repository = makeRepository({
      findById: jest.fn().mockResolvedValue(parent),
    });
    const useCase = new CreateFolder(repository);

    const output = await useCase.execute({
      ownerId,
      name: "Reports",
      parentId: parent.id.value,
    });

    expect(output.parentId).toBe(parent.id.value);
  });

  it("fails when the explicit parent does not exist", async () => {
    const useCase = new CreateFolder(makeRepository());
    await expect(
      useCase.execute({
        ownerId,
        name: "Reports",
        parentId: "33333333-3333-3333-3333-333333333333",
      }),
    ).rejects.toBeInstanceOf(ParentFolderNotFoundError);
  });

  it("fails when the parent belongs to another user", async () => {
    const parent = Folder.create({
      name: "Work",
      ownerId: otherOwnerId,
      parentId: grandParentId,
    });
    const useCase = new CreateFolder(
      makeRepository({ findById: jest.fn().mockResolvedValue(parent) }),
    );
    await expect(
      useCase.execute({ ownerId, name: "Reports", parentId: parent.id.value }),
    ).rejects.toBeInstanceOf(FolderAccessDeniedError);
  });

  it("fails when the user has no root folder and no parent is given", async () => {
    const useCase = new CreateFolder(makeRepository());
    await expect(
      useCase.execute({ ownerId, name: "Documents" }),
    ).rejects.toBeInstanceOf(ParentFolderNotFoundError);
  });
});
