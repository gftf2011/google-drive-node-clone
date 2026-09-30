import type { Embedder } from "../../application/ports/embedding/embedder";

export interface TransformersJsEmbedderOptions {
  /**
   * Modelo de embeddings (Hub da HF, formato ONNX do Transformers.js). O default
   * é pequeno e roda em CPU. Ex.: "Xenova/bge-small-en-v1.5",
   * "Xenova/all-MiniLM-L6-v2".
   */
  model?: string;
}

/** Assinatura mínima do pipeline de feature-extraction do Transformers.js. */
type FeatureExtractionPipeline = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

/**
 * Adapter de `Embedder` usando Transformers.js (`@xenova/transformers`).
 *
 * Roda o modelo IN-PROCESS, em CPU, sem serviço externo e sem chave de API — os
 * pesos são baixados uma vez do Hub e ficam em cache local. É o que permite o
 * chunking semântico self-hosted. O mesmo modelo escolhido aqui deverá ser
 * reutilizado na busca vetorial do RAG (consistência de espaço de embedding).
 *
 * Requisito: `npm i @xenova/transformers`. O import é dinâmico e preguiçoso —
 * o modelo (caro de carregar) só sobe na primeira chamada e é reaproveitado.
 */
export class TransformersJsEmbedder implements Embedder {
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(private readonly options: TransformersJsEmbedderOptions = {}) {}

  private load(): Promise<FeatureExtractionPipeline> {
    if (this.pipelinePromise === null) {
      // `import(<string>)` (não literal) evita a resolução estática do módulo —
      // mantém o esboço compilando antes de o pacote ser instalado.
      const moduleName = "@xenova/transformers";
      this.pipelinePromise = import(moduleName).then(
        (mod: { pipeline: (task: string, model: string) => Promise<FeatureExtractionPipeline> }) =>
          mod.pipeline(
            "feature-extraction",
            this.options.model ?? "Xenova/bge-small-en-v1.5",
          ),
      );
    }
    return this.pipelinePromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const pipeline = await this.load();
    // `mean` pooling + `normalize` → um vetor normalizado por texto.
    const output = await pipeline(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  }
}
