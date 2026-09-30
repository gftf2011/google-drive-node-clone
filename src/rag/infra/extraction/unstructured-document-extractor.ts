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
  metadata?: {
    page_number?: number;
    text_as_html?: string;
    coordinates?: unknown;
    languages?: string[];
    [key: string]: unknown;
  };
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
      .map((element) => this.toElement(element))
      .filter((element) => element.text.length > 0);

    // Idioma do documento: o mais frequente entre os elementos que o informam.
    const language = this.dominantLanguage(parsed);

    return {
      text: elements.map((element) => element.text).join("\n\n"),
      elements,
      metadata: {
        elementCount: parsed.length,
        ...(language === undefined ? {} : { language }),
      },
      extractor: "unstructured",
    };
  }

  /** Mapeia um elemento do Unstructured preservando página e metadado estrutural. */
  private toElement(element: UnstructuredElement): ExtractedElement {
    const meta = element.metadata ?? {};
    const preserved: Record<string, unknown> = {};
    if (meta.text_as_html !== undefined) {
      preserved.text_as_html = meta.text_as_html;
    }
    if (meta.coordinates !== undefined) {
      preserved.coordinates = meta.coordinates;
    }
    return {
      type: element.type ?? "Element",
      text: (element.text ?? "").trim(),
      page: meta.page_number,
      metadata: Object.keys(preserved).length > 0 ? preserved : undefined,
    };
  }

  /** Idioma dominante declarado pelos elementos (`metadata.languages[0]`). */
  private dominantLanguage(elements: UnstructuredElement[]): string | undefined {
    const counts = new Map<string, number>();
    for (const element of elements) {
      const language = element.metadata?.languages?.[0];
      if (language !== undefined) {
        counts.set(language, (counts.get(language) ?? 0) + 1);
      }
    }
    let best: string | undefined;
    let bestCount = 0;
    for (const [language, count] of counts) {
      if (count > bestCount) {
        best = language;
        bestCount = count;
      }
    }
    return best;
  }
}
