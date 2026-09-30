import type { UseCase } from "../../../shared/application/use-case";
import { RagDocument } from "../../domain/aggregates/rag-document";
import type { RagDocumentRepository } from "../../domain/repositories/rag-document-repository";

export interface EnqueueDocumentIngestionInput {
  fileId: string;
  ownerId: string;
  folderId: string;
  storageKey: string;
  contentType: string;
  fileName: string;
  /** SHA-256 (hex) informado pelo cliente; permite dedup sem baixar o objeto. */
  contentHash?: string;
}

/**
 * Caso de uso: enfileira a ingestão de um documento (cria a linha `pending`).
 *
 * É deliberadamente LEVE — só uma escrita. Roda dentro da transação que cria o
 * arquivo (via `FileCreated` + dispatcher síncrono), então precisa ser barato:
 * o trabalho pesado (extração) fica para o worker assíncrono. O `save` é
 * idempotente por id, então reprocessar o mesmo evento não duplica a fila.
 */
export class EnqueueDocumentIngestion
  implements UseCase<EnqueueDocumentIngestionInput, void>
{
  constructor(private readonly documents: RagDocumentRepository) {}

  async execute(input: EnqueueDocumentIngestionInput): Promise<void> {
    const document = RagDocument.enqueue(input);
    await this.documents.save(document);
  }
}
