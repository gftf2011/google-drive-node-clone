import type { Readable } from "node:stream";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { ExtractedDocument } from "../../application/ports/extraction/document-extractor";
import type {
  ExtractedContentStore,
  SourceObjectReader,
} from "../../application/ports/storage/ingestion-storage";

export interface S3IngestionStorageOptions {
  region: string;
  bucket: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  /** Prefixo das chaves dos artefatos extraídos (ex.: "extracted/"). */
  extractedPrefix: string;
  /**
   * Validade da URL assinada entregue ao extrator, em segundos. Deve cobrir o
   * tempo de extração de um documento grande (por isso maior que o presign de
   * upload).
   */
  sourceUrlExpiresInSeconds: number;
}

/**
 * Adapter S3 das portas de storage da ingestão.
 *
 * NÃO materializa o arquivo em memória: `openStream` devolve o corpo do
 * GetObject como stream (hasheável de passagem) e `presignDownloadUrl` assina
 * uma URL para o serviço de extração puxar o objeto direto do S3. Assim a
 * memória do worker fica O(chunk), independentemente do tamanho do arquivo. O
 * artefato extraído (texto, pequeno perto do binário) é gravado sob
 * `${extractedPrefix}${hash}.json`, chaveado pelo hash — duplicados compartilham.
 */
export class S3IngestionStorage
  implements SourceObjectReader, ExtractedContentStore
{
  private readonly client: S3Client;

  constructor(private readonly options: S3IngestionStorageOptions) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async openStream(storageKey: string): Promise<Readable> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.options.bucket, Key: storageKey }),
    );
    if (result.Body === undefined) {
      throw new Error(`Objeto sem corpo no storage: "${storageKey}".`);
    }
    // No Node, o `Body` do SDK v3 é um `Readable` — devolvido sem bufferizar.
    return result.Body as Readable;
  }

  async presignDownloadUrl(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: storageKey }),
      { expiresIn: this.options.sourceUrlExpiresInSeconds },
    );
  }

  async exists(contentHash: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.options.bucket,
          Key: this.keyFor(contentHash),
        }),
      );
      return true;
    } catch {
      // HeadObject lança (404/NotFound) quando a chave não existe.
      return false;
    }
  }

  async save(contentHash: string, content: ExtractedDocument): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: this.keyFor(contentHash),
        Body: JSON.stringify(content),
        ContentType: "application/json",
      }),
    );
  }

  private keyFor(contentHash: string): string {
    return `${this.options.extractedPrefix}${contentHash}.json`;
  }
}
