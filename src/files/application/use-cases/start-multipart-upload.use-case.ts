import type { UseCase } from "../../../shared/application/use-case";
import { Upload } from "../../domain/aggregates/upload";
import type { UploadRepository } from "../../domain/repositories/upload-repository";
import { PartPlan } from "../../domain/value-objects/part-plan";
import type { ObjectStorage } from "../ports/storage/object-storage";

export interface StartMultipartUploadInput {
  ownerId: string;
  folderId: string;
  fileName: string;
  contentType: string;
  /** Tamanho total declarado do arquivo, em bytes. */
  size: number;
  /** Tamanho de parte sugerido pelo cliente (bytes). Opcional; o backend ajusta. */
  partSize?: number;
}

/** Uma parte a enviar, já com a URL pré-assinada. */
export interface PresignedPart {
  partNumber: number;
  url: string;
}

export interface StartMultipartUploadOutput {
  /** Id do agregado — o handle que o cliente usa nas próximas chamadas. */
  uploadId: string;
  /** Chave do objeto no storage (útil para depuração/observabilidade). */
  key: string;
  /** Tamanho de cada parte (a última pode ser menor). O front fatia por este valor. */
  partSize: number;
  /** URLs pré-assinadas, uma por parte, na ordem 1..N. */
  parts: PresignedPart[];
  /** Segundos até as URLs expirarem (reassine com /parts/sign se estourar). */
  expiresInSeconds: number;
}

/**
 * Caso de uso: inicia um multipart upload e devolve JÁ TODAS as URLs
 * pré-assinadas.
 *
 * O backend não recebe bytes: ele cria a sessão no storage, calcula o plano de
 * partes (a partir do tamanho) e assina uma URL por parte. O front então faz o
 * `PUT` de cada pedaço direto no storage e, ao final, chama `/complete` com as
 * ETags. Assinar é só HMAC (sem rede), então geramos todas de uma vez.
 *
 * Ordem importa: cria a sessão no storage ANTES de persistir, para gravar já
 * com o `storageUploadId`. Se a persistência falhar depois, resta no storage um
 * multipart órfão — inofensivo e coletável por regra de lifecycle do bucket.
 *
 * É uma única escrita atômica (um `save`), então dispensa a Unit of Work — que,
 * além do mais, manteria uma transação de banco aberta durante as chamadas ao
 * storage.
 */
export class StartMultipartUpload
  implements UseCase<StartMultipartUploadInput, StartMultipartUploadOutput>
{
  constructor(
    private readonly uploads: UploadRepository,
    private readonly storage: ObjectStorage,
    private readonly presignExpiresInSeconds: number,
  ) {}

  async execute(
    input: StartMultipartUploadInput,
  ): Promise<StartMultipartUploadOutput> {
    const upload = Upload.open({
      ownerId: input.ownerId,
      folderId: input.folderId,
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.size,
    });

    const storageUploadId = await this.storage.createMultipartUpload({
      key: upload.storageKey.value,
      contentType: upload.contentType.value,
    });
    upload.attachStorageUpload(storageUploadId);

    await this.uploads.save(upload);

    const plan = PartPlan.for({
      size: upload.size.bytes,
      requestedPartSize: input.partSize,
    });
    const parts = await this.presignParts(upload, storageUploadId, plan);

    return {
      uploadId: upload.id.value,
      key: upload.storageKey.value,
      partSize: plan.partSize,
      parts,
      expiresInSeconds: this.presignExpiresInSeconds,
    };
  }

  private async presignParts(
    upload: Upload,
    storageUploadId: string,
    plan: PartPlan,
  ): Promise<PresignedPart[]> {
    const tasks: Promise<PresignedPart>[] = [];
    for (let partNumber = 1; partNumber <= plan.partCount; partNumber++) {
      tasks.push(
        this.storage
          .presignUploadPart({
            key: upload.storageKey.value,
            storageUploadId,
            partNumber,
            expiresInSeconds: this.presignExpiresInSeconds,
          })
          .then((url) => ({ partNumber, url })),
      );
    }
    return Promise.all(tasks);
  }
}
