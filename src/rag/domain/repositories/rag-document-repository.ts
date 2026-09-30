import type { RagDocument } from "../aggregates/rag-document";

/**
 * Contrato de persistência do agregado RagDocument — parte do DOMÍNIO.
 * A implementação concreta (Prisma) vive na infra.
 */
export interface RagDocumentRepository {
  /** Persiste um documento de ingestão (novo ou já existente), chaveado por id. */
  save(document: RagDocument): Promise<void>;

  /** Busca por id (o id do arquivo); `null` se não existir. */
  findByFileId(fileId: string): Promise<RagDocument | null>;

  /**
   * Existe algum documento JÁ EXTRAÍDO com este `contentHash` DESTE dono? Usado
   * para deduplicar: se sim, o novo documento reaproveita o artefato existente.
   * O escopo por dono confina o efeito de um hash informado incorretamente ao
   * próprio dono — nunca cruza o conteúdo de outro.
   */
  existsExtractedByContentHash(
    contentHash: string,
    ownerId: string,
  ): Promise<boolean>;

  /**
   * Reivindica até `limit` documentos `pending` para processamento, marcando-os
   * `extracting` atomicamente. A implementação usa `FOR UPDATE SKIP LOCKED` para
   * que múltiplos workers concorrentes nunca peguem a mesma linha — a base do
   * throughput sob grande volume.
   */
  claimPending(limit: number): Promise<RagDocument[]>;
}
