import {
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  CompleteMultipartUploadInput,
  CompletedObject,
  CreateMultipartUploadInput,
  ObjectStorage,
  PresignDownloadInput,
  PresignUploadPartInput,
} from "../../application/ports/storage/object-storage";

export interface S3ObjectStorageOptions {
  region: string;
  bucket: string;
  /** Endpoint do S3. Em dev, o simulador `floci` (ex.: http://localhost:4566). */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Path-style (`endpoint/bucket/key`) em vez de virtual-host
   * (`bucket.endpoint/key`). Obrigatório com o `floci`/LocalStack, que não
   * resolvem subdomínios por bucket.
   */
  forcePathStyle: boolean;
}

/**
 * Adapter S3 da porta `ObjectStorage` (AWS SDK v3).
 *
 * É o ÚNICO ponto que conhece a AWS. Aponta para o S3 real em produção ou para
 * o simulador `floci` em dev — só muda a configuração (endpoint/credenciais),
 * nunca o restante do código. O envio dos bytes é feito pelo cliente via URL
 * pré-assinada; aqui só orquestramos a sessão de multipart.
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly options: S3ObjectStorageOptions) {
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

  async createMultipartUpload(
    input: CreateMultipartUploadInput,
  ): Promise<string> {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.options.bucket,
        Key: input.key,
        ContentType: input.contentType,
      }),
    );
    if (result.UploadId === undefined) {
      throw new Error("O storage não retornou um UploadId para o multipart.");
    }
    return result.UploadId;
  }

  async presignUploadPart(input: PresignUploadPartInput): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.options.bucket,
      Key: input.key,
      UploadId: input.storageUploadId,
      PartNumber: input.partNumber,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    });
  }

  async presignDownload(input: PresignDownloadInput): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: input.key,
      ResponseContentType: input.contentType,
      // Aspas quebrariam o cabeçalho; removidas do nome exibido no download.
      ResponseContentDisposition: `attachment; filename="${input.fileName.replace(
        /"/g,
        "",
      )}"`,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    });
  }

  async completeMultipartUpload(
    input: CompleteMultipartUploadInput,
  ): Promise<CompletedObject> {
    const result = await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.options.bucket,
        Key: input.key,
        UploadId: input.storageUploadId,
        MultipartUpload: {
          Parts: input.parts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
      }),
    );
    return {
      etag: result.ETag ?? "",
      location: result.Location ?? "",
    };
  }

  async deleteObjects(input: { keys: readonly string[] }): Promise<void> {
    // O S3 aceita no máximo 1000 chaves por requisição DeleteObjects.
    const BATCH = 1000;
    for (let i = 0; i < input.keys.length; i += BATCH) {
      const chunk = input.keys.slice(i, i + BATCH);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.options.bucket,
          Delete: {
            Objects: chunk.map((key) => ({ Key: key })),
            // Não devolve a lista de removidos, só erros — resposta menor.
            Quiet: true,
          },
        }),
      );
    }
  }

  /**
   * Garante que o bucket exista e aceite `PUT` do navegador (CORS). Destinado ao
   * DESENVOLVIMENTO com o `floci` — em produção o bucket e o CORS são
   * provisionados por infraestrutura, não pela aplicação.
   */
  async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.options.bucket }),
      );
    } catch {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.options.bucket }),
      );
    }

    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: this.options.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedOrigins: ["*"],
              AllowedHeaders: ["*"],
              // Sem isto o JS do navegador não lê a ETag de cada parte enviada.
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
  }
}
