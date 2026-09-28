import type { ListSort } from "../../../shared/application/list-sort";
import type { PrismaTransactionContext } from "../../../shared/infra/database/prisma/prisma-transaction-context";
import { FileMetadata } from "../../domain/aggregates/file-metadata";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";

/** Traduz o critério de ordenação para o `orderBy` do Prisma. */
function orderBy(sort: ListSort): { createdAt: "desc" } | { name: "asc" } {
  return sort === "recent" ? { createdAt: "desc" } : { name: "asc" };
}

/**
 * Implementação Prisma do `FileMetadataRepository`. Usa o client corrente do
 * `PrismaTransactionContext`, participando da transação ativa quando houver — é
 * o que permite gravar o arquivo e concluir o upload no MESMO commit.
 *
 * `size` é persistido como `BigInt`; convertemos de/para `number` na fronteira
 * (seguro: o teto de negócio, 5 TiB, fica bem abaixo de `MAX_SAFE_INTEGER`).
 */
export class PrismaFileMetadataRepository implements FileMetadataRepository {
  constructor(private readonly context: PrismaTransactionContext) {}

  async findById(id: string): Promise<FileMetadata | null> {
    const row = await this.context.client.fileMetadata.findUnique({
      where: { id },
    });
    return row === null ? null : this.toDomain(row);
  }

  async save(file: FileMetadata): Promise<void> {
    const data = {
      ownerId: file.ownerId.value,
      folderId: file.folderId.value,
      name: file.name.value,
      contentType: file.contentType.value,
      size: BigInt(file.size.bytes),
      storageKey: file.storageKey.value,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
    await this.context.client.fileMetadata.upsert({
      where: { id: file.id.value },
      create: { id: file.id.value, ...data },
      update: data,
    });
  }

  async findByFolderId(
    folderId: string,
    ownerId: string,
    sort: ListSort,
  ): Promise<FileMetadata[]> {
    const rows = await this.context.client.fileMetadata.findMany({
      where: { folderId, ownerId },
      orderBy: orderBy(sort),
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findByFolderIds(folderIds: readonly string[]): Promise<FileMetadata[]> {
    if (folderIds.length === 0) {
      return [];
    }
    const rows = await this.context.client.fileMetadata.findMany({
      where: { folderId: { in: [...folderIds] } },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async deleteByFolderIds(folderIds: readonly string[]): Promise<void> {
    if (folderIds.length === 0) {
      return;
    }
    await this.context.client.fileMetadata.deleteMany({
      where: { folderId: { in: [...folderIds] } },
    });
  }

  private toDomain(row: {
    id: string;
    ownerId: string;
    folderId: string;
    name: string;
    contentType: string;
    size: bigint;
    storageKey: string;
    createdAt: Date;
    updatedAt: Date;
  }): FileMetadata {
    return FileMetadata.restore({
      id: row.id,
      ownerId: row.ownerId,
      folderId: row.folderId,
      name: row.name,
      contentType: row.contentType,
      size: Number(row.size),
      storageKey: row.storageKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
