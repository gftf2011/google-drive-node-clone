import type {
  GenerateInput,
  TextGenerator,
} from "../../application/ports/enrichment/text-generator";

export interface OllamaTextGeneratorOptions {
  /** URL do Ollama (ex.: http://localhost:11434). */
  baseUrl: string;
  /** Modelo (ex.: "llama3.1", "qwen2.5"). */
  model: string;
  /** Timeout por requisição, em ms. */
  timeoutMs: number;
  /** Tentativas em falha transitória (rede/5xx). */
  maxRetries: number;
}

/** Resposta do endpoint `/api/generate` do Ollama (campo relevante). */
interface OllamaResponse {
  response?: string;
}

/**
 * Adapter de `TextGenerator` para o Ollama (LLM self-hosted, sem chave de API).
 *
 * Production-like: timeout por requisição (`AbortController`), retry com backoff
 * em falhas transitórias e `format: "json"` quando se pede JSON. Trocar por um
 * provedor hospedado (Anthropic/OpenAI) é escrever outro adapter desta mesma
 * porta — o enricher não muda.
 */
export class OllamaTextGenerator implements TextGenerator {
  constructor(private readonly options: OllamaTextGeneratorOptions) {}

  async generate(input: GenerateInput): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await this.callOnce(input);
      } catch (error) {
        lastError = error;
        if (attempt < this.options.maxRetries) {
          await this.backoff(attempt);
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Ollama: falha ao gerar texto.");
  }

  private async callOnce(input: GenerateInput): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(`${this.options.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.options.model,
          prompt: input.prompt,
          stream: false,
          ...(input.json === true ? { format: "json" } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Ollama respondeu ${response.status}.`);
      }
      const parsed = (await response.json()) as OllamaResponse;
      return parsed.response ?? "";
    } finally {
      clearTimeout(timer);
    }
  }

  private backoff(attempt: number): Promise<void> {
    const ms = 200 * 2 ** attempt;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
