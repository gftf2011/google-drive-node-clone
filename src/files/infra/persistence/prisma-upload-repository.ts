import type { PrismaTransactionContext } from "../../../shared/infra/database/prisma/prisma-transaction-context";
import { Upload } from "../../domain/aggregates/upload";
import type { UploadStatus } from "../../domain/aggregates/upload";
import type { UploadRepository } from "../../domain/repositories/upload-repository";

/**
 * Implementação Prisma do `UploadRepository`. Usa o client corrente do
 * `PrismaTransactionContext`, participando da transação ativa quando houver.
 *
 * `size` é persistido como `BigInt` (arquivos passam de 2 GiB); na fronteira do
 * repositório convertemos de/para `number` — seguro, pois o teto de negócio
 * (5 TiB) fica bem abaixo de `Number.MAX_SAFE_INTEGER`.
 */
export class PrismaUploadRepository implements UploadRepository {
  constructor(private readonly context: PrismaTransactionContext) {}

  async findById(id: string): Promise<Upload | null> {
    const row = await this.context.client.upload.findUnique({ where: { id } });
    if (row === null) {
      return null;
    }
    return Upload.restore({
      id: row.id,
      ownerId: row.ownerId,
      folderId: row.folderId,
      fileName: row.fileName,
      contentType: row.contentType,
      size: Number(row.size),
      storageKey: row.storageKey,
      storageUploadId: row.storageUploadId,
      status: row.status as UploadStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(upload: Upload): Promise<void> {
    const data = {
      ownerId: upload.ownerId.value,
      folderId: upload.folderId.value,
      fileName: upload.fileName.value,
      contentType: upload.contentType.value,
      size: BigInt(upload.size.bytes),
      storageKey: upload.storageKey.value,
      storageUploadId: upload.storageUploadId,
      status: upload.status,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
    };
    await this.context.client.upload.upsert({
      where: { id: upload.id.value },
      create: { id: upload.id.value, ...data },
      update: data,
    });
  }
}
