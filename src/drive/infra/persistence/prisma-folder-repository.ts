import type { ListSort } from "../../../shared/application/list-sort";
import type { PrismaTransactionContext } from "../../../shared/infra/database/prisma/prisma-transaction-context";
import { Folder } from "../../domain/aggregates/folder";
import type { FolderRepository } from "../../domain/repositories/folder-repository";

/** Traduz o critério de ordenação para o `orderBy` do Prisma. */
function orderBy(sort: ListSort): { createdAt: "desc" } | { name: "asc" } {
  return sort === "recent" ? { createdAt: "desc" } : { name: "asc" };
}

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

  async findById(id: string): Promise<Folder | null> {
    const row = await this.context.client.folder.findUnique({ where: { id } });
    return row === null ? null : this.toDomain(row);
  }

  async findRootByOwnerId(ownerId: string): Promise<Folder | null> {
    const row = await this.context.client.folder.findFirst({
      where: { ownerId, parentId: null },
    });
    return row === null ? null : this.toDomain(row);
  }

  async findByOwnerId(ownerId: string): Promise<Folder[]> {
    const rows = await this.context.client.folder.findMany({
      where: { ownerId },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findChildren(
    parentId: string,
    ownerId: string,
    sort: ListSort,
  ): Promise<Folder[]> {
    const rows = await this.context.client.folder.findMany({
      where: { parentId, ownerId },
      orderBy: orderBy(sort),
    });
    return rows.map((row) => this.toDomain(row));
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

  async deleteByIds(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.context.client.folder.deleteMany({
      where: { id: { in: [...ids] } },
    });
  }

  private toDomain(row: {
    id: string;
    name: string;
    ownerId: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Folder {
    return Folder.restore({
      id: row.id,
      name: row.name,
      ownerId: row.ownerId,
      parentId: row.parentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
