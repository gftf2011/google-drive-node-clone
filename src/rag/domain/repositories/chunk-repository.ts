import type { Chunk } from "../../application/ports/chunking/chunker";
import type { ChunkEnrichment } from "../../application/ports/enrichment/chunk-enricher";

/** Uma linha a persistir: o chunk + seu embedding + os metadados derivados. */
export interface PersistChunkRow {
  chunk: Chunk;
  /** Embedding do conteúdo; nulo quando não há. */
  embedding: number[] | null;
  /** Metadados gerados (resumo, keywords, perguntas hipotéticas). */
  enrichment: ChunkEnrichment;
  /** Idioma detectado do documento, se conhecido. */
  language: string | null;
}

export interface PersistChunksInput {
  fileId: string;
  ownerId: string;
  /** Pasta do arquivo — filtro de busca (e escopo de segurança) no RAG. */
  folderId: string;
  rows: PersistChunkRow[];
}

/**
 * Contrato de persistência dos chunks de um documento — parte do DOMÍNIO.
 *
 * A implementação (pgvector, via SQL cru) vive na infra. O tipo `vector`/HNSW
 * não é expresso pelo Prisma; por isso esta porta fala em termos de domínio
 * (chunks + embeddings + metadados) e o adapter cuida do SQL.
 */
export interface ChunkRepository {
  /**
   * Substitui TODOS os chunks do arquivo pelos informados (apaga os antigos e
   * insere os novos), atomicamente — reingestão do mesmo arquivo é idempotente.
   */
  replaceForFile(input: PersistChunksInput): Promise<void>;
}
