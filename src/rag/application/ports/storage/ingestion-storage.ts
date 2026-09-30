import type { Readable } from "node:stream";

import type { ExtractedDocument } from "../extraction/document-extractor";

/**
 * Porta de leitura do objeto de origem (o arquivo enviado).
 *
 * Deliberadamente SEM um `getBytes(): Uint8Array` — materializar o arquivo
 * inteiro em memória não escala para documentos de GBs. Em vez disso:
 *  - `openStream` devolve um stream (para hashear de passagem, memória O(chunk));
 *  - `presignDownloadUrl` devolve uma URL assinada para o serviço de extração
 *    PUXAR o arquivo direto do storage, sem passar pelos bytes do worker.
 */
export interface SourceObjectReader {
  /** Abre um stream de leitura dos bytes do objeto. */
  openStream(storageKey: string): Promise<Readable>;

  /** URL assinada de GET, para o extrator baixar o objeto direto do storage. */
  presignDownloadUrl(storageKey: string): Promise<string>;
}

/**
 * Porta de escrita do artefato EXTRAÍDO. O conteúdo extraído é guardado uma vez
 * por `contentHash` — documentos duplicados compartilham o mesmo artefato, sem
 * reprocessar. (O storage de objetos escala melhor que o banco para o volume de
 * texto extraído; o banco guarda só o estado da ingestão.)
 */
export interface ExtractedContentStore {
  /** Já existe artefato extraído para este hash? */
  exists(contentHash: string): Promise<boolean>;
  /** Persiste o conteúdo extraído sob a chave derivada do hash. */
  save(contentHash: string, content: ExtractedDocument): Promise<void>;
}
