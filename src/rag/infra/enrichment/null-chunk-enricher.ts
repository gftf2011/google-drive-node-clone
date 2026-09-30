import type {
  ChunkEnricher,
  ChunkEnrichment,
} from "../../application/ports/enrichment/chunk-enricher";

/**
 * `ChunkEnricher` no-op: devolve enriquecimento vazio, sem chamar LLM algum.
 *
 * É o adapter do modo LITE (máquinas modestas) — a ingestão fatia, embedda e
 * persiste normalmente, só sem resumo/keywords/perguntas. Nenhum serviço
 * externo (Ollama) é necessário.
 */
export class NullChunkEnricher implements ChunkEnricher {
  async enrich(): Promise<ChunkEnrichment> {
    return { summary: "", keywords: [], hypotheticalQuestions: [] };
  }
}
