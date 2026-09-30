import type {
  DocumentExtractor,
  ExtractInput,
  ExtractedDocument,
} from "../../application/ports/extraction/document-extractor";

export interface RoutingExtractors {
  /** Especialista em PDF (layout, tabelas). */
  docling: DocumentExtractor;
  /** Especialista em documentos ricos/semiestruturados (Office, HTML, e-mail). */
  unstructured: DocumentExtractor;
  /** Extrator universal e fallback. */
  tika: DocumentExtractor;
}

/**
 * Media types que o Unstructured trata melhor (formatos ricos e estruturados).
 * O prefixo `application/vnd.openxmlformats` cobre docx/xlsx/pptx modernos.
 */
const UNSTRUCTURED_PREFIXES = [
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-",
  "application/msword",
  "application/rtf",
  "text/html",
  "application/xhtml",
  "text/markdown",
  "text/csv",
  "message/rfc822",
];

/**
 * Extrator COMPOSTO: roteia cada documento para a ferramenta certa pelo seu
 * media type e cai para a próxima em caso de falha (Tika é sempre o último
 * recurso). Implementa a mesma porta `DocumentExtractor`, então os casos de uso
 * enxergam um extrator único — a estratégia de roteamento fica encapsulada aqui.
 *
 *   PDF                         → Docling → Unstructured → Tika
 *   Office/HTML/e-mail/ricos    → Unstructured → Tika
 *   qualquer outro              → Tika
 */
export class RoutingDocumentExtractor implements DocumentExtractor {
  constructor(private readonly extractors: RoutingExtractors) {}

  async extract(input: ExtractInput): Promise<ExtractedDocument> {
    return this.runChain(this.chainFor(input.contentType), input);
  }

  private chainFor(contentType: string): DocumentExtractor[] {
    const type = contentType.split(";")[0]!.trim().toLowerCase();
    const { docling, unstructured, tika } = this.extractors;

    if (type === "application/pdf") {
      return [docling, unstructured, tika];
    }
    if (UNSTRUCTURED_PREFIXES.some((prefix) => type.startsWith(prefix))) {
      return [unstructured, tika];
    }
    return [tika];
  }

  /** Tenta cada extrator em ordem; devolve o 1º sucesso ou propaga o último erro. */
  private async runChain(
    chain: DocumentExtractor[],
    input: ExtractInput,
  ): Promise<ExtractedDocument> {
    let lastError: unknown;
    for (const extractor of chain) {
      try {
        return await extractor.extract(input);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Nenhum extrator conseguiu processar "${input.fileName}".`);
  }
}
