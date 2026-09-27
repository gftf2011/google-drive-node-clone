import type { Folder } from "../../domain/aggregates/folder";
import type { FolderRepository } from "../../domain/repositories/folder-repository";

/**
 * Implementação em memória do `FolderRepository`. Substituível por Prisma sem
 * impacto no domínio/aplicação.
 */
export class InMemoryFolderRepository implements FolderRepository {
  private readonly folders: Folder[] = [];

  async existsRootByOwnerId(ownerId: string): Promise<boolean> {
    return this.folders.some(
      (folder) => folder.isRoot && folder.ownerId.value === ownerId,
    );
  }

  async save(folder: Folder): Promise<void> {
    this.folders.push(folder);
  }
}
