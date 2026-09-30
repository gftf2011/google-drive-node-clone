import type {
  DocumentExtractor,
  ExtractInput,
  ExtractedDocument,
  ExtractedElement,
} from "../../application/ports/extraction/document-extractor";
import { streamMultipartFile } from "./stream-multipart-file";

/** Elemento como a API do Unstructured o devolve. */
interface UnstructuredElement {
  type?: string;
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface UnstructuredOptions {
  baseUrl: string;
  /** Chave de API (opcional na imagem self-hosted; obrigatória no SaaS). */
  apiKey?: string;
}

/**
 * Adapter de extração via Unstructured (`/general/v0/general`).
 *
 * O Unstructured brilha em documentos RICOS e semiestruturados (Office moderno,
 * HTML, e-mail, apresentações): devolve uma LISTA de elementos tipados (títulos,
 * parágrafos, tabelas, listas), preservando a estrutura — muito além do texto
 * plano. Por isso o roteador o prefere para esses formatos.
 */
export class UnstructuredDocumentExtractor implements DocumentExtractor {
  constructor(private readonly options: UnstructuredOptions) {}

  async extract(input: ExtractInput): Promise<ExtractedDocument> {
    // Streaming: o arquivo é empurrado como um corpo `multipart/form-data`
    // montado sobre o stream, sem bufferizar os bytes.
    const { body, contentType } = streamMultipartFile({
      field: "files",
      fileName: input.fileName,
      fileContentType: input.contentType,
      stream: await input.openStream(),
    });

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": contentType,
    };
    if (this.options.apiKey !== undefined) {
      headers["unstructured-api-key"] = this.options.apiKey;
    }

    const response = await fetch(`${this.options.baseUrl}/general/v0/general`, {
      method: "POST",
      headers,
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    if (!response.ok) {
      throw new Error(
        `Unstructured respondeu ${response.status} ao extrair "${input.fileName}".`,
      );
    }

    const parsed = (await response.json()) as UnstructuredElement[];
    const elements: ExtractedElement[] = parsed
      .map((element) => ({
        type: element.type ?? "Element",
        text: (element.text ?? "").trim(),
      }))
      .filter((element) => element.text.length > 0);

    return {
      text: elements.map((element) => element.text).join("\n\n"),
      elements,
      metadata: { elementCount: parsed.length },
      extractor: "unstructured",
    };
  }
}
