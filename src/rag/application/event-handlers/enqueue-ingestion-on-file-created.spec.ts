import { FileCreated } from "../../../drive/domain/events/file-created.event";
import { FileId } from "../../../drive/domain/value-objects/file-id";
import type { EnqueueDocumentIngestion } from "../use-cases/enqueue-document-ingestion.use-case";

import { EnqueueIngestionOnFileCreated } from "./enqueue-ingestion-on-file-created";

describe("EnqueueIngestionOnFileCreated", () => {
  it("mapeia o evento FileCreated para o input do caso de uso de enfileiramento", async () => {
    const enqueue = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as EnqueueDocumentIngestion;
    const handler = new EnqueueIngestionOnFileCreated(enqueue);

    const fileId = FileId.create();
    const event = new FileCreated({
      fileId,
      ownerId: "22222222-2222-2222-2222-222222222222",
      folderId: "33333333-3333-3333-3333-333333333333",
      storageKey: "users/owner/file",
      contentType: "application/pdf",
      fileName: "report.pdf",
      occurredAt: new Date(),
    });

    await handler.handle(event);

    expect(enqueue.execute).toHaveBeenCalledWith({
      fileId: fileId.value,
      ownerId: "22222222-2222-2222-2222-222222222222",
      folderId: "33333333-3333-3333-3333-333333333333",
      storageKey: "users/owner/file",
      contentType: "application/pdf",
      fileName: "report.pdf",
    });
  });
});
