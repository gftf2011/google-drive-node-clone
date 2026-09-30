import type { EventHandler } from "../../../shared/application/event-handler";
import type { FileCreated } from "../../../drive/domain/events/file-created.event";
import type { EnqueueDocumentIngestion } from "../use-cases/enqueue-document-ingestion.use-case";

/**
 * Enfileira a ingestão quando um arquivo é criado no Drive.
 *
 * O `rag` depende apenas do EVENTO `FileCreated` (um DTO autocontido), nunca dos
 * agregados/repositórios do `drive` — os contextos permanecem desacoplados. A
 * ligação por nome (`drive.file-created`) é feita no composition root.
 */
export class EnqueueIngestionOnFileCreated implements EventHandler<FileCreated> {
  constructor(private readonly enqueue: EnqueueDocumentIngestion) {}

  async handle(event: FileCreated): Promise<void> {
    await this.enqueue.execute({
      fileId: event.aggregateId,
      ownerId: event.ownerId,
      folderId: event.folderId,
      storageKey: event.storageKey,
      contentType: event.contentType,
      fileName: event.fileName,
      contentHash: event.contentHash,
    });
  }
}
