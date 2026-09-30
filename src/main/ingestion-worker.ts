import "dotenv/config";

import { DoclingDocumentExtractor } from "../rag/infra/extraction/docling-document-extractor";
import { RoutingDocumentExtractor } from "../rag/infra/extraction/routing-document-extractor";
import { TikaDocumentExtractor } from "../rag/infra/extraction/tika-document-extractor";
import { UnstructuredDocumentExtractor } from "../rag/infra/extraction/unstructured-document-extractor";
import { PrismaRagDocumentRepository } from "../rag/infra/persistence/prisma-rag-document-repository";
import { S3IngestionStorage } from "../rag/infra/storage/s3-ingestion-storage";
import { IngestDocument } from "../rag/application/use-cases/ingest-document.use-case";
import {
  closeDatabase,
  prisma,
} from "../shared/infra/database/prisma/client";
import { PrismaTransactionContext } from "../shared/infra/database/prisma/prisma-transaction-context";

import { loadEnv } from "./config/env";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Worker de ingestão — processo SEPARADO da API.
 *
 * Sonda a fila (`rag_documents` com status `pending`), reivindica um lote com
 * `FOR UPDATE SKIP LOCKED` (então N réplicas do worker escalam horizontalmente
 * sem processar a mesma linha) e roda o pipeline de extração por documento. É
 * aqui que mora o trabalho pesado — fora da transação que cria o arquivo.
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const context = new PrismaTransactionContext(prisma);
  const documents = new PrismaRagDocumentRepository(context);

  const storage = new S3IngestionStorage({
    region: env.storage.region,
    bucket: env.storage.bucket,
    endpoint: env.storage.endpoint,
    accessKeyId: env.storage.accessKeyId,
    secretAccessKey: env.storage.secretAccessKey,
    forcePathStyle: env.storage.forcePathStyle,
    extractedPrefix: env.ingestion.extractedPrefix,
    sourceUrlExpiresInSeconds: env.ingestion.sourceUrlExpiresInSeconds,
  });

  const extractor = new RoutingDocumentExtractor({
    docling: new DoclingDocumentExtractor(env.ingestion.doclingUrl),
    unstructured: new UnstructuredDocumentExtractor({
      baseUrl: env.ingestion.unstructuredUrl,
      apiKey: env.ingestion.unstructuredApiKey,
    }),
    tika: new TikaDocumentExtractor(env.ingestion.tikaUrl),
  });

  const ingestDocument = new IngestDocument(
    documents,
    storage,
    extractor,
    storage,
  );

  let running = true;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      // Para de reivindicar novos lotes; o lote atual termina antes de sair.
      running = false;
    });
  }

  console.log("[ingest:worker] iniciado; sondando a fila de ingestão…");

  while (running) {
    const batch = await documents.claimPending(env.ingestion.workerBatchSize);
    if (batch.length === 0) {
      // Fila vazia: espera antes de sondar de novo (evita busy-loop).
      await sleep(env.ingestion.workerPollIntervalMs);
      continue;
    }

    const results = await Promise.all(
      batch.map((document) => ingestDocument.execute(document)),
    );
    for (const result of results) {
      console.log(`[ingest:worker] ${result.fileId} → ${result.outcome}`);
    }
    // Sem espera: drena a fila enquanto houver trabalho.
  }

  console.log("[ingest:worker] encerrando…");
  await closeDatabase();
  process.exit(0);
}

void bootstrap();
