import { randomUUID } from "node:crypto";

import type { PrismaTransactionContext } from "../../../shared/infra/database/prisma/prisma-transaction-context";
import type {
  ChunkRepository,
  PersistChunksInput,
} from "../../domain/repositories/chunk-repository";

/**
 * PgVectorStore — implementação de `ChunkRepository` sobre a tabela `rag_chunks`
 * (pgvector), acessada por SQL CRU (o Prisma não expressa `vector`/HNSW).
 *
 * `replaceForFile` apaga os chunks antigos do arquivo e insere os novos na MESMA
 * transação (via `PrismaTransactionContext`, que também é a Unit of Work), então
 * reingestão nunca deixa chunks pela metade nem duplicados. O embedding é
 * serializado no literal do pgvector (`[v1,v2,…]`) e convertido com `::vector`.
 */
export class PgVectorChunkRepository implements ChunkRepository {
  constructor(private readonly context: PrismaTransactionContext) {}

  async replaceForFile(input: PersistChunksInput): Promise<void> {
    await this.context.runInTransaction(async () => {
      const client = this.context.client;
      await client.$executeRawUnsafe(
        `DELETE FROM "rag_chunks" WHERE "file_id" = $1`,
        input.fileId,
      );

      const now = new Date();
      for (const row of input.rows) {
        const { chunk, embedding, enrichment, language } = row;
        await client.$executeRawUnsafe(
          `INSERT INTO "rag_chunks"
             ("id","file_id","owner_id","folder_id","chunk_index","kind",
              "heading_trail","content","char_count","page","language",
              "summary","keywords","hypothetical_questions","metadata",
              "embedding","created_at")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                   $12,$13,$14,$15::jsonb,$16::vector,$17)`,
          randomUUID(),
          input.fileId,
          input.ownerId,
          input.folderId,
          chunk.index,
          chunk.kind,
          chunk.headingTrail,
          chunk.text,
          chunk.charCount,
          chunk.page,
          language,
          enrichment.summary.length > 0 ? enrichment.summary : null,
          enrichment.keywords,
          enrichment.hypotheticalQuestions,
          JSON.stringify(chunk.metadata),
          embedding === null ? null : this.toVectorLiteral(embedding),
          now,
        );
      }
    });
  }

  /** `[0.12,0.34,…]` — literal aceito pelo cast `::vector` do pgvector. */
  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
  }
}
