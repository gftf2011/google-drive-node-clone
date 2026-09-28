import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import type { UseCase } from "../../../shared/application/use-case";
import type { Folder } from "../../domain/aggregates/folder";
import { CannotDeleteRootFolderError } from "../../domain/errors/cannot-delete-root-folder.error";
import { FolderAccessDeniedError } from "../../domain/errors/folder-access-denied.error";
import { FolderNotFoundError } from "../../domain/errors/folder-not-found.error";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { FolderRepository } from "../../domain/repositories/folder-repository";
import { OwnerId } from "../../domain/value-objects/owner-id";
import type { ObjectStorage } from "../ports/storage/object-storage";

export interface DeleteFolderInput {
  folderId: string;
  ownerId: string;
}

/**
 * Caso de uso: deleta uma pasta e TODA a sua subárvore (subpastas + arquivos).
 *
 * Como pastas e arquivos vivem no MESMO contexto (`drive`), a remoção é feita
 * diretamente — sem eventos entre contextos:
 *   1. Valida: a pasta existe, é do dono e não é a raiz.
 *   2. Calcula a subárvore (a pasta + descendentes).
 *   3. Remove, na MESMA transação, os arquivos e as pastas da subárvore.
 *   4. Após o commit, apaga os objetos no storage em lote (best-effort).
 *
 * As chaves são coletadas ANTES de remover as linhas; a limpeza no S3 fica FORA
 * da transação (não há transação distribuída DB↔S3) e é idempotente — um objeto
 * que não puder ser removido vira órfão inofensivo.
 */
export class DeleteFolder implements UseCase<DeleteFolderInput, void> {
  constructor(
    private readonly folders: FolderRepository,
    private readonly files: FileMetadataRepository,
    private readonly storage: ObjectStorage,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: DeleteFolderInput): Promise<void> {
    const folder = await this.folders.findById(input.folderId);
    if (folder === null) {
      throw new FolderNotFoundError(input.folderId);
    }
    if (folder.ownerId.value !== OwnerId.restore(input.ownerId).value) {
      throw new FolderAccessDeniedError(input.folderId);
    }
    if (folder.isRoot) {
      throw new CannotDeleteRootFolderError(input.folderId);
    }

    const all = await this.folders.findByOwnerId(folder.ownerId.value);
    const subtreeIds = collectSubtreeIds(folder.id.value, all);

    const filesInSubtree = await this.files.findByFolderIds(subtreeIds);

    await this.unitOfWork.runInTransaction(async () => {
      await this.files.deleteByFolderIds(subtreeIds);
      await this.folders.deleteByIds(subtreeIds);
    });

    if (filesInSubtree.length > 0) {
      try {
        await this.storage.deleteObjects({
          keys: filesInSubtree.map((file) => file.storageKey.value),
        });
      } catch {
        // Best-effort: objetos que não puderam ser removidos viram órfãos.
      }
    }
  }
}

/** Coleta o id da pasta e de todas as descendentes (BFS na árvore em memória). */
function collectSubtreeIds(rootId: string, all: Folder[]): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const folder of all) {
    const parentId = folder.parentId?.value;
    if (parentId === undefined) {
      continue;
    }
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(folder.id.value);
    childrenByParent.set(parentId, siblings);
  }

  const ids: string[] = [];
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ids.push(current);
    queue.push(...(childrenByParent.get(current) ?? []));
  }
  return ids;
}
