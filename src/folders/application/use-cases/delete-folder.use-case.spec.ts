import type { DomainEventPublisher } from "../../../shared/application/ports/domain-event-publisher";
import type { DomainEvent } from "../../../shared/domain/events/domain-event";
import { Folder } from "../../domain/aggregates/folder";
import { CannotDeleteRootFolderError } from "../../domain/errors/cannot-delete-root-folder.error";
import { FolderAccessDeniedError } from "../../domain/errors/folder-access-denied.error";
import { FolderNotFoundError } from "../../domain/errors/folder-not-found.error";
import type { FolderRepository } from "../../domain/repositories/folder-repository";

import { DeleteFolder } from "./delete-folder.use-case";

const ownerId = "11111111-1111-1111-1111-111111111111";
const otherOwnerId = "99999999-9999-9999-9999-999999999999";

const root = Folder.createRoot({ ownerId });
const a = Folder.create({ name: "A", ownerId, parentId: root.id.value });
const b = Folder.create({ name: "B", ownerId, parentId: a.id.value });
const c = Folder.create({ name: "C", ownerId, parentId: root.id.value });
const tree = [root, a, b, c];

interface Published {
  events: DomainEvent[];
  publisher: DomainEventPublisher;
}

function makePublisher(): Published {
  const events: DomainEvent[] = [];
  return {
    events,
    publisher: {
      publishAll: jest.fn().mockImplementation(async (batch: DomainEvent[]) => {
        events.push(...batch);
      }),
    },
  };
}

function makeRepo(target: Folder | null): FolderRepository {
  return {
    existsRootByOwnerId: jest.fn(),
    findById: jest.fn().mockResolvedValue(target),
    findRootByOwnerId: jest.fn(),
    findByOwnerId: jest.fn().mockResolvedValue(tree),
    save: jest.fn(),
    deleteByIds: jest.fn().mockResolvedValue(undefined),
  };
}

describe("DeleteFolder", () => {
  it("deletes the folder and its whole subtree, and announces the ids", async () => {
    const repo = makeRepo(a);
    const { publisher, events } = makePublisher();
    const useCase = new DeleteFolder(repo, publisher);

    await useCase.execute({ folderId: a.id.value, ownerId });

    expect(repo.deleteByIds).toHaveBeenCalledWith([a.id.value, b.id.value]);
    expect(events).toHaveLength(1);
    const published = events[0] as unknown as { folderIds: string[] };
    expect(published.folderIds).toEqual([a.id.value, b.id.value]);
  });

  it("purges files (event) before removing folder rows", async () => {
    const repo = makeRepo(a);
    const { publisher } = makePublisher();
    const useCase = new DeleteFolder(repo, publisher);

    await useCase.execute({ folderId: a.id.value, ownerId });

    const publishOrder = (publisher.publishAll as jest.Mock).mock
      .invocationCallOrder[0]!;
    const deleteOrder = (repo.deleteByIds as jest.Mock).mock
      .invocationCallOrder[0]!;
    expect(publishOrder).toBeLessThan(deleteOrder);
  });

  it("fails when the folder does not exist", async () => {
    const useCase = new DeleteFolder(makeRepo(null), makePublisher().publisher);
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
      makeRepo(foreign),
      makePublisher().publisher,
    );
    await expect(
      useCase.execute({ folderId: foreign.id.value, ownerId }),
    ).rejects.toBeInstanceOf(FolderAccessDeniedError);
  });

  it("refuses to delete the root folder", async () => {
    const useCase = new DeleteFolder(makeRepo(root), makePublisher().publisher);
    await expect(
      useCase.execute({ folderId: root.id.value, ownerId }),
    ).rejects.toBeInstanceOf(CannotDeleteRootFolderError);
  });
});
