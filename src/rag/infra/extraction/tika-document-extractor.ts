import type {
  DocumentExtractor,
  ExtractInput,
  ExtractedDocument,
} from "../../application/ports/extraction/document-extractor";

/** Chave onde o Tika devolve o texto extraído no endpoint `/rmeta/text`. */
const TIKA_CONTENT_KEY = "X-TIKA:content";

/**
 * Adapter de extração via Apache Tika Server.
 *
 * Tika é o EXTRATOR UNIVERSAL — reconhece centenas de formatos (Office legado,
 * RTF, e-mail, imagens com OCR, etc.). É o fallback do roteador para tudo que
 * não tem um extrator especializado. Usa `PUT /rmeta/text`, que devolve, num só
 * JSON, o texto (`X-TIKA:content`) e os metadados do documento.
 */
export class TikaDocumentExtractor implements DocumentExtractor {
  constructor(private readonly baseUrl: string) {}

  async extract(input: ExtractInput): Promise<ExtractedDocument> {
    // Empurra os bytes em STREAMING (PUT com corpo `Readable`, `duplex: "half"`)
    // — nunca bufferiza o arquivo, então documentos de GBs não estouram a memória.
    const response = await fetch(`${this.baseUrl}/rmeta/text`, {
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
        Accept: "application/json",
      },
      body: await input.openStream(),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    if (!response.ok) {
      throw new Error(
        `Tika respondeu ${response.status} ao extrair "${input.fileName}".`,
      );
    }

    // `/rmeta` devolve um array (um item por documento embutido); usamos o 1º.
    const parsed = (await response.json()) as Record<string, unknown>[];
    const first = parsed[0] ?? {};
    const text = String(first[TIKA_CONTENT_KEY] ?? "").trim();

    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(first)) {
      if (key !== TIKA_CONTENT_KEY) {
        metadata[key] = value;
      }
    }

    return {
      text,
      elements: text.length > 0 ? [{ type: "Document", text }] : [],
      metadata,
      extractor: "tika",
    };
  }
}
