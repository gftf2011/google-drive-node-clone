import type { PrismaTransactionContext } from "../../../shared/infra/database/prisma/prisma-transaction-context";
import { RagDocument } from "../../domain/aggregates/rag-document";
import type { RagDocumentRepository } from "../../domain/repositories/rag-document-repository";
import type { IngestionStatusValue } from "../../domain/value-objects/ingestion-status";

/** Linha crua de `rag_documents` (colunas snake_case) para o claim via SQL. */
interface RagDocumentRow {
  file_id: string;
  owner_id: string;
  folder_id: string;
  storage_key: string;
  content_type: string;
  file_name: string;
  status: IngestionStatusValue;
  error: string | null;
  content_hash: string | null;
  chunk_count: number;
  indexed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Implementação Prisma do `RagDocumentRepository`. Usa o client corrente do
 * `PrismaTransactionContext` — participa da transação ativa quando houver (é o
 * que permite enfileirar a ingestão no MESMO commit que cria o arquivo).
 */
export class PrismaRagDocumentRepository implements RagDocumentRepository {
  constructor(private readonly context: PrismaTransactionContext) {}

  async save(document: RagDocument): Promise<void> {
    const data = {
      ownerId: document.ownerId,
      folderId: document.folderId,
      storageKey: document.storageKey,
      contentType: document.contentType,
      fileName: document.fileName,
      status: document.status.value,
      error: document.error,
      contentHash: document.contentHash?.value ?? null,
      chunkCount: document.chunkCount,
      indexedAt: document.indexedAt,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
    await this.context.client.ragDocument.upsert({
      where: { fileId: document.id.value },
      create: { fileId: document.id.value, ...data },
      update: data,
    });
  }

  async findByFileId(fileId: string): Promise<RagDocument | null> {
    const model = await this.context.client.ragDocument.findUnique({
      where: { fileId },
    });
    return model === null
      ? null
      : RagDocument.restore({
          fileId: model.fileId,
          ownerId: model.ownerId,
          folderId: model.folderId,
          storageKey: model.storageKey,
          contentType: model.contentType,
          fileName: model.fileName,
          status: model.status as IngestionStatusValue,
          error: model.error,
          contentHash: model.contentHash,
          chunkCount: model.chunkCount,
          indexedAt: model.indexedAt,
          createdAt: model.createdAt,
          updatedAt: model.updatedAt,
        });
  }

  async existsExtractedByContentHash(
    contentHash: string,
    ownerId: string,
  ): Promise<boolean> {
    const row = await this.context.client.ragDocument.findFirst({
      where: { contentHash, ownerId, status: "extracted" },
      select: { fileId: true },
    });
    return row !== null;
  }

  /**
   * Reivindica até `limit` documentos `pending` marcando-os `extracting` numa
   * única instrução atômica. `FOR UPDATE SKIP LOCKED` faz cada worker pular as
   * linhas já travadas por outro — nada de contenção nem processamento dobrado.
   */
  async claimPending(limit: number): Promise<RagDocument[]> {
    const rows = await this.context.client.$queryRawUnsafe<RagDocumentRow[]>(
      `UPDATE "rag_documents"
          SET "status" = 'extracting', "updated_at" = now()
        WHERE "file_id" IN (
          SELECT "file_id" FROM "rag_documents"
           WHERE "status" = 'pending'
           ORDER BY "created_at"
           FOR UPDATE SKIP LOCKED
           LIMIT $1
        )
      RETURNING *`,
      limit,
    );
    return rows.map((row) => this.rowToDomain(row));
  }

  private rowToDomain(row: RagDocumentRow): RagDocument {
    return RagDocument.restore({
      fileId: row.file_id,
      ownerId: row.owner_id,
      folderId: row.folder_id,
      storageKey: row.storage_key,
      contentType: row.content_type,
      fileName: row.file_name,
      status: row.status,
      error: row.error,
      contentHash: row.content_hash,
      chunkCount: Number(row.chunk_count),
      indexedAt: row.indexed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
