import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { RagDocument } from "../../domain/aggregates/rag-document";
import type { RagDocumentRepository } from "../../domain/repositories/rag-document-repository";
import type {
  DocumentExtractor,
  ExtractedDocument,
} from "../ports/extraction/document-extractor";
import type {
  ExtractedContentStore,
  SourceObjectReader,
} from "../ports/storage/ingestion-storage";

import { IngestDocument } from "./ingest-document.use-case";

const fileId = "11111111-1111-1111-1111-111111111111";
const bytes = new Uint8Array([1, 2, 3, 4]);
const expectedHash = createHash("sha256").update(bytes).digest("hex");

const ownerId = "22222222-2222-2222-2222-222222222222";

/** Documento já reivindicado pelo worker (estado `extracting`). */
function claimed(contentHash: string | null = null): RagDocument {
  return RagDocument.restore({
    fileId,
    ownerId,
    folderId: "33333333-3333-3333-3333-333333333333",
    storageKey: "users/owner/file",
    contentType: "application/pdf",
    fileName: "report.pdf",
    status: "extracting",
    error: null,
    contentHash,
    chunkCount: 0,
    indexedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRepo(
  existsExtracted: boolean,
): RagDocumentRepository & { saved: RagDocument[] } {
  const saved: RagDocument[] = [];
  return {
    saved,
    save: jest.fn(async (doc: RagDocument) => {
      saved.push(doc);
    }),
    findByFileId: jest.fn().mockResolvedValue(null),
    existsExtractedByContentHash: jest.fn().mockResolvedValue(existsExtracted),
    claimPending: jest.fn().mockResolvedValue([]),
  };
}

// Novo stream a cada chamada — um Readable só pode ser consumido uma vez.
const source: SourceObjectReader = {
  openStream: jest.fn(async () => Readable.from([Buffer.from(bytes)])),
  presignDownloadUrl: jest.fn().mockResolvedValue("https://signed.example/obj"),
};

function makeExtractor(elements = 3): DocumentExtractor {
  const extracted: ExtractedDocument = {
    text: "conteúdo",
    elements: Array.from({ length: elements }, (_, i) => ({
      type: "Paragraph",
      text: `p${i}`,
    })),
    metadata: {},
    extractor: "docling",
  };
  return { extract: jest.fn().mockResolvedValue(extracted) };
}

function makeStore(): ExtractedContentStore {
  return {
    exists: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

describe("IngestDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("extrai, guarda o artefato e marca extracted com a contagem de elementos", async () => {
    const repo = makeRepo(false);
    const extractor = makeExtractor(3);
    const store = makeStore();
    const useCase = new IngestDocument(repo, source, extractor, store);

    const result = await useCase.execute(claimed());

    expect(result.outcome).toBe("extracted");
    expect(extractor.extract).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "application/pdf",
        sourceUrl: "https://signed.example/obj",
        openStream: expect.any(Function),
      }),
    );
    expect(store.save).toHaveBeenCalledWith(
      expectedHash,
      expect.objectContaining({ extractor: "docling" }),
    );
    const saved = repo.saved[0]!;
    expect(saved.status.value).toBe("extracted");
    expect(saved.contentHash?.value).toBe(expectedHash);
    expect(saved.chunkCount).toBe(3);
  });

  it("deduplica: se o hash já foi extraído, marca duplicate sem extrair", async () => {
    const repo = makeRepo(true);
    const extractor = makeExtractor();
    const store = makeStore();
    const useCase = new IngestDocument(repo, source, extractor, store);

    const result = await useCase.execute(claimed());

    expect(result.outcome).toBe("duplicate");
    expect(repo.existsExtractedByContentHash).toHaveBeenCalledWith(
      expectedHash,
      ownerId,
    );
    expect(extractor.extract).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
    expect(repo.saved[0]!.status.value).toBe("duplicate");
  });

  it("usa o hash informado no upload sem ler o objeto (dedup zero-read)", async () => {
    const repo = makeRepo(true); // já existe extraído com esse hash
    const useCase = new IngestDocument(
      repo,
      source,
      makeExtractor(),
      makeStore(),
    );

    const result = await useCase.execute(claimed(expectedHash));

    expect(result.outcome).toBe("duplicate");
    // Não abriu stream para hashear — o hash já veio do upload.
    expect(source.openStream).not.toHaveBeenCalled();
    expect(repo.existsExtractedByContentHash).toHaveBeenCalledWith(
      expectedHash,
      ownerId,
    );
  });

  it("marca failed (sem lançar) quando a extração falha", async () => {
    const repo = makeRepo(false);
    const extractor: DocumentExtractor = {
      extract: jest.fn().mockRejectedValue(new Error("Docling respondeu 500")),
    };
    const useCase = new IngestDocument(repo, source, extractor, makeStore());

    const result = await useCase.execute(claimed());

    expect(result.outcome).toBe("failed");
    const saved = repo.saved[0]!;
    expect(saved.status.value).toBe("failed");
    expect(saved.error).toBe("Docling respondeu 500");
  });
});
