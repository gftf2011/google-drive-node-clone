import type { Readable } from "node:stream";

/** Um elemento de conteúdo extraído do documento (parágrafo, título, tabela…). */
export interface ExtractedElement {
  /** Tipo do elemento quando a ferramenta o informa (ex.: "Title", "Table"). */
  type: string;
  /** Texto do elemento. */
  text: string;
}

/** Resultado normalizado da extração, independente da ferramenta usada. */
export interface ExtractedDocument {
  /** Texto plano concatenado — a visão simples do conteúdo. */
  text: string;
  /** Elementos estruturados; ao menos um quando a ferramenta os fornece. */
  elements: ExtractedElement[];
  /** Metadados soltos que a ferramenta devolveu (páginas, autor, etc.). */
  metadata: Record<string, unknown>;
  /** Qual ferramenta produziu este resultado (ex.: "tika", "docling"). */
  extractor: string;
}

export interface ExtractInput {
  contentType: string;
  fileName: string;
  /**
   * URL assinada de GET do objeto. Extratores que sabem PUXAR do storage
   * (ex.: Docling `/v1/convert/source`) usam isto — o arquivo nunca passa pela
   * memória do worker.
   */
  sourceUrl: string;
  /**
   * Abre (sob demanda) um stream dos bytes. Extratores que precisam EMPURRAR os
   * bytes ao serviço (ex.: Tika, Unstructured) fazem streaming a partir daqui,
   * sem bufferizar o arquivo inteiro. É uma fábrica para permitir reabrir o
   * stream em uma nova tentativa da cadeia de fallback.
   */
  openStream: () => Promise<Readable>;
}

/**
 * Porta de saída para extração de conteúdo de um documento.
 *
 * Abstrai a ferramenta de extração (Apache Tika, Unstructured, Docling…). A
 * aplicação NÃO conhece o protocolo de cada serviço: URLs, formatos de resposta
 * e autenticação vivem nos ADAPTERS da infra. O roteamento por formato é feito
 * por um adapter composto (`RoutingDocumentExtractor`), que também implementa
 * esta porta — os casos de uso enxergam sempre um único `DocumentExtractor`.
 */
export interface DocumentExtractor {
  extract(input: ExtractInput): Promise<ExtractedDocument>;
}
