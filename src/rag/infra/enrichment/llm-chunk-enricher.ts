import type {
  ChunkEnricher,
  ChunkEnrichment,
  EnrichChunkInput,
} from "../../application/ports/enrichment/chunk-enricher";
import type { TextGenerator } from "../../application/ports/enrichment/text-generator";

export interface LlmChunkEnricherOptions {
  maxKeywords: number;
  maxQuestions: number;
  /** Corta o texto enviado ao LLM (controla custo/latência/limite de contexto). */
  maxInputChars: number;
}

const EMPTY: ChunkEnrichment = {
  summary: "",
  keywords: [],
  hypotheticalQuestions: [],
};

/** Forma bruta esperada do JSON do LLM (antes de validar/normalizar). */
interface RawEnrichment {
  summary?: unknown;
  keywords?: unknown;
  hypothetical_questions?: unknown;
}

/**
 * `ChunkEnricher` baseado em LLM (via a porta `TextGenerator`).
 *
 * Production-like: pede JSON estrito, VALIDA e normaliza a resposta, limita
 * tamanhos e DEGRADA GRACIOSAMENTE — qualquer falha (LLM fora, JSON inválido,
 * timeout) devolve enriquecimento vazio em vez de lançar. Enriquecer é
 * best-effort: o chunk é persistido e continua recuperável pelo vetor de
 * conteúdo mesmo sem resumo/keywords/perguntas.
 */
export class LlmChunkEnricher implements ChunkEnricher {
  constructor(
    private readonly generator: TextGenerator,
    private readonly options: LlmChunkEnricherOptions,
  ) {}

  async enrich(input: EnrichChunkInput): Promise<ChunkEnrichment> {
    try {
      const raw = await this.generator.generate({
        prompt: this.buildPrompt(input),
        json: true,
      });
      return this.parse(raw);
    } catch {
      // LLM indisponível, timeout, etc. — nunca derruba a ingestão.
      return EMPTY;
    }
  }

  private buildPrompt(input: EnrichChunkInput): string {
    const context =
      input.headingTrail.length > 0
        ? `Seção: ${input.headingTrail.join(" > ")}\n`
        : "";
    const language = input.language ?? "o mesmo idioma do texto";
    const text = input.text.slice(0, this.options.maxInputChars);

    return [
      "Você enriquece trechos de documentos para um sistema de busca (RAG).",
      `Responda em ${language}. Responda APENAS com JSON válido, sem comentários.`,
      "Formato exato:",
      '{"summary": string, "keywords": string[], "hypothetical_questions": string[]}',
      `- summary: 1-2 frases resumindo o trecho.`,
      `- keywords: até ${this.options.maxKeywords} termos salientes.`,
      `- hypothetical_questions: até ${this.options.maxQuestions} perguntas que este trecho responde.`,
      "",
      `${context}Trecho:\n"""\n${text}\n"""`,
    ].join("\n");
  }

  /** Extrai e normaliza o JSON; tolera cercas de código ao redor. */
  private parse(raw: string): ChunkEnrichment {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return EMPTY;
    }
    const parsed = JSON.parse(raw.slice(start, end + 1)) as RawEnrichment;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      keywords: this.stringList(parsed.keywords, this.options.maxKeywords),
      hypotheticalQuestions: this.stringList(
        parsed.hypothetical_questions,
        this.options.maxQuestions,
      ),
    };
  }

  private stringList(value: unknown, max: number): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, max);
  }
}
