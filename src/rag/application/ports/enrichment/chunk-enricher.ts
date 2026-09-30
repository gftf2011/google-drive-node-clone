/** Metadados DERIVADOS de um chunk (gerados, não extraídos do arquivo). */
export interface ChunkEnrichment {
  /** Resumo curto do chunk. */
  summary: string;
  /** Palavras-chave / termos salientes. */
  keywords: string[];
  /**
   * Perguntas hipotéticas que este chunk RESPONDE. Melhoram a recuperação: uma
   * pergunta do usuário casa melhor com uma pergunta do que com o texto corrido
   * (futuramente podem ser embeddadas para busca pergunta-a-pergunta).
   */
  hypotheticalQuestions: string[];
}

export interface EnrichChunkInput {
  text: string;
  /** Trilha de cabeçalhos (contexto de seção) para orientar o enriquecimento. */
  headingTrail: string[];
  /** Idioma-alvo do resumo/perguntas, quando conhecido (ex.: "pt", "en"). */
  language: string | null;
}

/**
 * Porta de saída para ENRIQUECER um chunk com metadados derivados (resumo,
 * keywords, perguntas hipotéticas). A estratégia (LLM local, hospedado…) vive no
 * ADAPTER; a aplicação só pede o enriquecimento. É best-effort: o adapter deve
 * degradar graciosamente (devolver vazio) em falha, nunca lançar — enriquecer é
 * opcional, a recuperação por conteúdo funciona sem isso.
 */
export interface ChunkEnricher {
  enrich(input: EnrichChunkInput): Promise<ChunkEnrichment>;
}
