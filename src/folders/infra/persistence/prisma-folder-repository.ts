import type { PrismaTransactionContext } from "../../../shared/infra/database/prisma/prisma-transaction-context";
import { Folder } from "../../domain/aggregates/folder";
import type { FolderRepository } from "../../domain/repositories/folder-repository";

/**
 * Implementação Prisma do `FolderRepository`. Usa o client corrente do
 * `PrismaTransactionContext`, participando da transação ativa quando houver.
 */
export class PrismaFolderRepository implements FolderRepository {
  constructor(private readonly context: PrismaTransactionContext) {}

  async existsRootByOwnerId(ownerId: string): Promise<boolean> {
    const count = await this.context.client.folder.count({
      where: { ownerId, parentId: null },
    });
    return count > 0;
  }

  async save(folder: Folder): Promise<void> {
    const data = {
      name: folder.name.value,
      ownerId: folder.ownerId.value,
      parentId: folder.parentId?.value ?? null,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
    await this.context.client.folder.upsert({
      where: { id: folder.id.value },
      create: { id: folder.id.value, ...data },
      update: data,
    });
  }
}
