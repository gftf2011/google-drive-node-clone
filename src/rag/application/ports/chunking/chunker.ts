import type { ExtractedDocument } from "../extraction/document-extractor";

/** Um pedaço do documento, pronto para (futuramente) virar embedding no RAG. */
export interface Chunk {
  /** Ordem do chunk dentro do documento (0-based). */
  index: number;
  /** Conteúdo do chunk. */
  text: string;
  /**
   * `table` = uma tabela preservada inteira (nunca dividida); `narrative` =
   * texto corrido, possivelmente cortado em fronteira semântica.
   */
  kind: "narrative" | "table";
  /**
   * Trilha de cabeçalhos (contexto de seção) vigente no chunk — ex.:
   * ["Introdução", "Motivação"]. Preserva o "onde isto está" no documento.
   */
  headingTrail: string[];
  /** Tamanho em caracteres (métrica barata de orçamento). */
  charCount: number;
  /** Página de origem (a 1ª dos elementos que o chunk abrange), se conhecida. */
  page: number | null;
  /**
   * Metadado estrutural herdado do documento e dos elementos abrangidos (ex.:
   * `text_as_html` de tabela, tipos de elemento). Vira `jsonb` na persistência.
   */
  metadata: Record<string, unknown>;
}

/**
 * Porta de saída para FATIAR um documento extraído em chunks.
 *
 * Abstrai a estratégia de chunking (semântica, por tamanho, por título…). A
 * aplicação não conhece embeddings nem tokenizers — isso vive no ADAPTER. É a
 * peça que liga a INGESTÃO (texto extraído) à futura camada de RAG (embeddings).
 */
export interface Chunker {
  chunk(document: ExtractedDocument): Promise<Chunk[]>;
}
