import type { DomainEventPublisher } from "../../../shared/application/ports/domain-event-publisher";
import type { UseCase } from "../../../shared/application/use-case";
import type { Folder } from "../../domain/aggregates/folder";
import { CannotDeleteRootFolderError } from "../../domain/errors/cannot-delete-root-folder.error";
import { FolderAccessDeniedError } from "../../domain/errors/folder-access-denied.error";
import { FolderNotFoundError } from "../../domain/errors/folder-not-found.error";
import { FolderDeleted } from "../../domain/events/folder-deleted.event";
import type { FolderRepository } from "../../domain/repositories/folder-repository";
import { OwnerId } from "../../domain/value-objects/owner-id";

export interface DeleteFolderInput {
  folderId: string;
  ownerId: string;
}

/**
 * Caso de uso: deleta uma pasta e TODA a sua subárvore.
 *
 * Passos, nesta ordem (segura, sem transação distribuída DB↔S3):
 *   1. Valida: a pasta existe, é do dono e não é a raiz.
 *   2. Calcula a subárvore (a pasta + descendentes) percorrendo as pastas do
 *      dono em memória.
 *   3. Anuncia `FolderDeleted` com os ids da subárvore → o contexto `files`
 *      apaga os arquivos (registros + objetos no S3) dessas pastas.
 *   4. Remove as linhas das pastas.
 *
 * Os arquivos são purgados ANTES das pastas para nunca deixar registro de
 * arquivo órfão apontando para uma pasta já removida.
 */
export class DeleteFolder implements UseCase<DeleteFolderInput, void> {
  constructor(
    private readonly folders: FolderRepository,
    private readonly events: DomainEventPublisher,
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

    await this.events.publishAll([
      new FolderDeleted(folder.id.value, subtreeIds, new Date()),
    ]);
    await this.folders.deleteByIds(subtreeIds);
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
