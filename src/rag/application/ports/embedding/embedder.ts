/**
 * Porta de saída para gerar EMBEDDINGS de textos.
 *
 * O `SemanticChunker` depende desta porta (não de um provedor concreto), então
 * o mesmo modelo que detecta fronteiras semânticas aqui poderá, na fase de RAG,
 * alimentar a busca vetorial — trocar o provedor (Transformers.js in-process,
 * TEI local, SaaS…) é trocar o ADAPTER, sem tocar no chunker.
 */
export interface Embedder {
  /**
   * Um vetor por texto de entrada, na mesma ordem. Os vetores devem vir
   * NORMALIZADOS (norma 1) — assim o cosseno vira simples produto interno.
   */
  embed(texts: string[]): Promise<number[][]>;
}
