import { Readable } from "node:stream";

import type {
  DocumentExtractor,
  ExtractInput,
  ExtractedDocument,
} from "../../application/ports/extraction/document-extractor";

import { RoutingDocumentExtractor } from "./routing-document-extractor";

function stub(name: string, fail = false): DocumentExtractor {
  return {
    extract: jest.fn(async (): Promise<ExtractedDocument> => {
      if (fail) {
        throw new Error(`${name} falhou`);
      }
      return { text: name, elements: [], metadata: {}, extractor: name };
    }),
  };
}

const input = (contentType: string): ExtractInput => ({
  contentType,
  fileName: "f",
  sourceUrl: "https://signed.example/obj",
  openStream: async () => Readable.from([Buffer.from([1, 2, 3])]),
});

describe("RoutingDocumentExtractor", () => {
  it("roteia PDF para o Docling", async () => {
    const docling = stub("docling");
    const unstructured = stub("unstructured");
    const tika = stub("tika");
    const router = new RoutingDocumentExtractor({ docling, unstructured, tika });

    const result = await router.extract(input("application/pdf"));

    expect(result.extractor).toBe("docling");
    expect(unstructured.extract).not.toHaveBeenCalled();
    expect(tika.extract).not.toHaveBeenCalled();
  });

  it("roteia docx para o Unstructured", async () => {
    const docling = stub("docling");
    const unstructured = stub("unstructured");
    const tika = stub("tika");
    const router = new RoutingDocumentExtractor({ docling, unstructured, tika });

    const result = await router.extract(
      input(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    );

    expect(result.extractor).toBe("unstructured");
    expect(docling.extract).not.toHaveBeenCalled();
  });

  it("usa o Tika como fallback para formatos genéricos", async () => {
    const router = new RoutingDocumentExtractor({
      docling: stub("docling"),
      unstructured: stub("unstructured"),
      tika: stub("tika"),
    });

    const result = await router.extract(input("text/plain"));

    expect(result.extractor).toBe("tika");
  });

  it("ignora o content-type com parâmetros (charset) ao rotear", async () => {
    const router = new RoutingDocumentExtractor({
      docling: stub("docling"),
      unstructured: stub("unstructured"),
      tika: stub("tika"),
    });

    const result = await router.extract(input("application/pdf; version=1.7"));

    expect(result.extractor).toBe("docling");
  });

  it("cai para o próximo extrator quando o primeiro falha", async () => {
    const docling = stub("docling", true); // falha
    const unstructured = stub("unstructured"); // sucesso
    const tika = stub("tika");
    const router = new RoutingDocumentExtractor({ docling, unstructured, tika });

    const result = await router.extract(input("application/pdf"));

    expect(docling.extract).toHaveBeenCalled();
    expect(result.extractor).toBe("unstructured");
  });

  it("propaga o erro quando todos os extratores da cadeia falham", async () => {
    const router = new RoutingDocumentExtractor({
      docling: stub("docling", true),
      unstructured: stub("unstructured", true),
      tika: stub("tika", true),
    });

    await expect(router.extract(input("application/pdf"))).rejects.toThrow(
      "tika falhou",
    );
  });
});
