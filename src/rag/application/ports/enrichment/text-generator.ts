export interface GenerateInput {
  prompt: string;
  /** Pede resposta em JSON estrito (o adapter ativa o "JSON mode" se suportar). */
  json?: boolean;
}

/**
 * Porta de saída para um GERADOR de texto (LLM). Abstrai o provedor — Ollama
 * local (self-hosted, sem chave), ou um hospedado (Anthropic/OpenAI) — atrás de
 * uma única operação. O `ChunkEnricher` baseado em LLM depende desta porta, não
 * de um provedor concreto: trocar o modelo/provedor é trocar o ADAPTER.
 */
export interface TextGenerator {
  generate(input: GenerateInput): Promise<string>;
}
