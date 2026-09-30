import { InvalidIngestionStatusError } from "../errors/invalid-ingestion-status.error";

import { RagDocument } from "./rag-document";

const fileId = "11111111-1111-1111-1111-111111111111";
const hash =
  "a".repeat(64); // SHA-256 hex de exemplo

function enqueued(): RagDocument {
  return RagDocument.enqueue({
    fileId,
    ownerId: "22222222-2222-2222-2222-222222222222",
    folderId: "33333333-3333-3333-3333-333333333333",
    storageKey: "users/owner/file",
    contentType: "application/pdf",
    fileName: "report.pdf",
  });
}

describe("RagDocument", () => {
  it("nasce pendente com contagem zero e sem hash", () => {
    const doc = enqueued();
    expect(doc.id.value).toBe(fileId);
    expect(doc.status.value).toBe("pending");
    expect(doc.chunkCount).toBe(0);
    expect(doc.contentHash).toBeNull();
    expect(doc.indexedAt).toBeNull();
  });

  it("segue o caminho feliz pending → extracting → extracted", () => {
    const doc = enqueued();
    doc.startExtraction();
    expect(doc.status.value).toBe("extracting");

    doc.markExtracted(hash, 7);
    expect(doc.status.value).toBe("extracted");
    expect(doc.contentHash?.value).toBe(hash);
    expect(doc.chunkCount).toBe(7);
    expect(doc.indexedAt).toBeInstanceOf(Date);
    expect(doc.error).toBeNull();
  });

  it("marca duplicate reaproveitando o hash, sem contagem de chunks", () => {
    const doc = enqueued();
    doc.startExtraction();
    doc.markDuplicate(hash);
    expect(doc.status.value).toBe("duplicate");
    expect(doc.contentHash?.value).toBe(hash);
    expect(doc.indexedAt).toBeInstanceOf(Date);
  });

  it("marca failed guardando o motivo", () => {
    const doc = enqueued();
    doc.startExtraction();
    doc.markFailed("Tika respondeu 500");
    expect(doc.status.value).toBe("failed");
    expect(doc.error).toBe("Tika respondeu 500");
  });

  it("atualiza updatedAt a cada transição (sem helper touch())", () => {
    const doc = enqueued();
    const before = doc.updatedAt.getTime();
    doc.startExtraction();
    expect(doc.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("rejeita transição ilegal (extracted é terminal)", () => {
    const doc = enqueued();
    doc.startExtraction();
    doc.markExtracted(hash, 1);
    expect(() => doc.markDuplicate(hash)).toThrow(InvalidIngestionStatusError);
  });

  it("não permite extrair a partir de pending direto (pula extracting)", () => {
    const doc = enqueued();
    expect(() => doc.markExtracted(hash, 1)).toThrow(
      InvalidIngestionStatusError,
    );
  });
});
