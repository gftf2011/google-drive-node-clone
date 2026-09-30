/**
 * Configuração da aplicação, lida e validada a partir de variáveis de ambiente.
 * Centraliza o acesso ao `process.env` — o resto do código recebe `Env` tipado.
 */
export interface Env {
  nodeEnv: string;
  host: string;
  port: number;
  jwt: {
    secret: string;
    expiresInSeconds: number;
  };
  storage: {
    region: string;
    bucket: string;
    /** Endpoint do S3. Em dev, o simulador `floci` (http://localhost:4566). */
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    /** Path-style é obrigatório com o `floci`/LocalStack. */
    forcePathStyle: boolean;
    /** Validade das URLs pré-assinadas de parte, em segundos. */
    presignExpiresInSeconds: number;
    /** Cota total de armazenamento por usuário, em bytes. */
    userQuotaBytes: number;
  };
  /** Pipeline de ingestão de documentos (contexto `rag`). */
  ingestion: {
    /**
     * `routing` = roteia por formato (PDF→Docling, ricos→Unstructured, resto→
     * Tika). `tika-only` = só Tika, para o modo LITE (não sobe Docling/
     * Unstructured).
     */
    extractorMode: "routing" | "tika-only";
    /** URL do Apache Tika Server (extrator universal / fallback). */
    tikaUrl: string;
    /** URL da API do Unstructured (documentos ricos). */
    unstructuredUrl: string;
    /** Chave de API do Unstructured (opcional na imagem self-hosted). */
    unstructuredApiKey?: string;
    /** URL do docling-serve (especialista em PDF). */
    doclingUrl: string;
    /** Prefixo das chaves dos artefatos extraídos no storage. */
    extractedPrefix: string;
    /** Validade da URL assinada entregue ao extrator, em segundos. */
    sourceUrlExpiresInSeconds: number;
    /** Quantos documentos o worker reivindica por ciclo. */
    workerBatchSize: number;
    /** Intervalo de sondagem da fila quando ela está vazia, em ms. */
    workerPollIntervalMs: number;
    /** Chunking (fatiamento estrutura-primeiro + semântico). */
    chunk: {
      maxChars: number;
      minChars: number;
      breakpointPercentile: number;
    };
    /**
     * Modelo de embeddings (Transformers.js, in-process). Deve casar com a
     * dimensão da coluna `embedding` de `rag_chunks` (bge-small = 384).
     */
    embeddingModel: string;
    /** Enriquecimento por LLM (resumo, keywords, perguntas hipotéticas). */
    enrichment: {
      /** Liga/desliga o enriquecimento. `false` = modo LITE, sem LLM/Ollama. */
      enabled: boolean;
      /** URL do LLM (Ollama self-hosted). */
      llmUrl: string;
      /** Modelo do LLM (ex.: "llama3.1"). */
      llmModel: string;
      llmTimeoutMs: number;
      llmMaxRetries: number;
      /** Enriquecimentos simultâneos por documento. */
      concurrency: number;
      maxKeywords: number;
      maxQuestions: number;
      maxInputChars: number;
    };
  };
}

const DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-please";

export function loadEnv(): Env {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  const jwtSecret = process.env.JWT_SECRET;
  if (isProduction && (jwtSecret === undefined || jwtSecret.length < 32)) {
    throw new Error(
      "JWT_SECRET é obrigatório em produção (mínimo de 32 caracteres).",
    );
  }

  // Endpoint ausente em produção = S3 real (SDK resolve pela região). Em dev,
  // aponta para o `floci`. `undefined` (não string vazia) para o SDK ignorá-lo.
  const storageEndpoint = process.env.STORAGE_ENDPOINT;

  return {
    nodeEnv,
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3333),
    jwt: {
      secret: jwtSecret ?? DEV_JWT_SECRET,
      expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 3600),
    },
    storage: {
      region: process.env.STORAGE_REGION ?? "us-east-1",
      bucket: process.env.STORAGE_BUCKET ?? "gdrive-uploads",
      endpoint:
        storageEndpoint !== undefined && storageEndpoint.length > 0
          ? storageEndpoint
          : undefined,
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "test",
      forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
      presignExpiresInSeconds: Number(
        process.env.STORAGE_PRESIGN_EXPIRES_IN_SECONDS ?? 900,
      ),
      // Default: 15 GiB por usuário.
      userQuotaBytes: Number(
        process.env.STORAGE_USER_QUOTA_BYTES ?? 15 * 1024 ** 3,
      ),
    },
    ingestion: {
      extractorMode:
        process.env.INGESTION_EXTRACTOR_MODE === "tika-only"
          ? "tika-only"
          : "routing",
      tikaUrl: process.env.INGESTION_TIKA_URL ?? "http://localhost:9998",
      unstructuredUrl:
        process.env.INGESTION_UNSTRUCTURED_URL ?? "http://localhost:8000",
      unstructuredApiKey:
        process.env.INGESTION_UNSTRUCTURED_API_KEY !== undefined &&
        process.env.INGESTION_UNSTRUCTURED_API_KEY.length > 0
          ? process.env.INGESTION_UNSTRUCTURED_API_KEY
          : undefined,
      doclingUrl: process.env.INGESTION_DOCLING_URL ?? "http://localhost:5001",
      extractedPrefix: process.env.INGESTION_EXTRACTED_PREFIX ?? "extracted/",
      // Default: 1 h — cobre a extração de documentos grandes.
      sourceUrlExpiresInSeconds: Number(
        process.env.INGESTION_SOURCE_URL_EXPIRES_IN_SECONDS ?? 3600,
      ),
      workerBatchSize: Number(process.env.INGESTION_WORKER_BATCH_SIZE ?? 10),
      workerPollIntervalMs: Number(
        process.env.INGESTION_WORKER_POLL_INTERVAL_MS ?? 2000,
      ),
      chunk: {
        maxChars: Number(process.env.INGESTION_CHUNK_MAX_CHARS ?? 1200),
        minChars: Number(process.env.INGESTION_CHUNK_MIN_CHARS ?? 200),
        breakpointPercentile: Number(
          process.env.INGESTION_CHUNK_BREAKPOINT_PERCENTILE ?? 90,
        ),
      },
      embeddingModel:
        process.env.INGESTION_EMBEDDING_MODEL ?? "Xenova/bge-small-en-v1.5",
      enrichment: {
        // Default: desligado — o modo seguro para máquinas modestas. Ligue
        // explicitamente (com Ollama disponível) para gerar os metadados.
        enabled: process.env.INGESTION_ENRICH_ENABLED === "true",
        llmUrl: process.env.INGESTION_LLM_URL ?? "http://localhost:11434",
        llmModel: process.env.INGESTION_LLM_MODEL ?? "llama3.1",
        llmTimeoutMs: Number(process.env.INGESTION_LLM_TIMEOUT_MS ?? 30000),
        llmMaxRetries: Number(process.env.INGESTION_LLM_MAX_RETRIES ?? 2),
        concurrency: Number(process.env.INGESTION_ENRICH_CONCURRENCY ?? 4),
        maxKeywords: Number(process.env.INGESTION_ENRICH_MAX_KEYWORDS ?? 6),
        maxQuestions: Number(process.env.INGESTION_ENRICH_MAX_QUESTIONS ?? 3),
        maxInputChars: Number(process.env.INGESTION_ENRICH_MAX_INPUT_CHARS ?? 4000),
      },
    },
  };
}
