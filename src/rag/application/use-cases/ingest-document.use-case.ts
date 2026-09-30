import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import type { UseCase } from "../../../shared/application/use-case";
import type { RagDocument } from "../../domain/aggregates/rag-document";
import type { RagDocumentRepository } from "../../domain/repositories/rag-document-repository";
import type { DocumentExtractor } from "../ports/extraction/document-extractor";
import type {
  ExtractedContentStore,
  SourceObjectReader,
} from "../ports/storage/ingestion-storage";

export type IngestDocumentOutcome = "extracted" | "duplicate" | "failed";

export interface IngestDocumentResult {
  fileId: string;
  outcome: IngestDocumentOutcome;
}

/**
 * Caso de uso: processa UM documento já reivindicado (`extracting`).
 *
 * O pipeline por documento:
 *   1. faz STREAMING do objeto por um SHA-256 (chave de dedup) — memória
 *      O(chunk), nunca materializa o arquivo, mesmo com GBs;
 *   2. se o conteúdo já foi extraído antes → marca `duplicate` (não reprocessa);
 *   3. senão → extrai com a ferramenta certa (que puxa o objeto pela URL
 *      assinada, ou recebe os bytes em streaming), guarda o artefato e marca
 *      `extracted`.
 *
 * Falhas são capturadas e persistidas como `failed` (com o motivo): um documento
 * problemático nunca derruba o lote do worker. Não abre transação — cada `save`
 * é uma escrita única e independente.
 *
 * Nota de confiança: o hash vindo do upload é CONFIADO (otimização de dedup
 * sobre os arquivos do próprio dono). O custo de um hash incorreto é uma dedup
 * perdida ou indevida — nunca corrupção de dados de outro dono, pois a dedup só
 * cruza documentos já extraídos. Onde isso não for aceitável, recalcule por
 * streaming ignorando o hash informado.
 */
export class IngestDocument
  implements UseCase<RagDocument, IngestDocumentResult>
{
  constructor(
    private readonly documents: RagDocumentRepository,
    private readonly source: SourceObjectReader,
    private readonly extractor: DocumentExtractor,
    private readonly contentStore: ExtractedContentStore,
  ) {}

  async execute(document: RagDocument): Promise<IngestDocumentResult> {
    const fileId = document.id.value;
    try {
      // Se o cliente já informou o hash no upload, usamos direto — dedup sem
      // NENHUMA leitura do objeto. Só recorremos ao streaming-hash (uma leitura,
      // memória O(chunk)) quando o hash não veio.
      const contentHash =
        document.contentHash?.value ??
        (await this.hashStream(
          await this.source.openStream(document.storageKey),
        ));

      if (
        await this.documents.existsExtractedByContentHash(
          contentHash,
          document.ownerId,
        )
      ) {
        document.markDuplicate(contentHash);
        await this.documents.save(document);
        return { fileId, outcome: "duplicate" };
      }

      const extracted = await this.extractor.extract({
        contentType: document.contentType,
        fileName: document.fileName,
        sourceUrl: await this.source.presignDownloadUrl(document.storageKey),
        openStream: () => this.source.openStream(document.storageKey),
      });
      await this.contentStore.save(contentHash, extracted);

      document.markExtracted(contentHash, extracted.elements.length);
      await this.documents.save(document);
      return { fileId, outcome: "extracted" };
    } catch (error) {
      document.markFailed(error instanceof Error ? error.message : String(error));
      await this.documents.save(document);
      return { fileId, outcome: "failed" };
    }
  }

  /** SHA-256 consumindo o stream em chunks — memória O(chunk), não O(arquivo). */
  private async hashStream(stream: Readable): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of stream) {
      hash.update(chunk as Buffer);
    }
    return hash.digest("hex");
  }
}
