import type { UseCase } from "../../../shared/application/use-case";
import { FileAccessDeniedError } from "../../domain/errors/file-access-denied.error";
import { FileNotFoundError } from "../../domain/errors/file-not-found.error";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import { OwnerId } from "../../domain/value-objects/owner-id";
import type { ObjectStorage } from "../ports/storage/object-storage";

export interface GetFileDownloadUrlInput {
  fileId: string;
  ownerId: string;
}

export interface GetFileDownloadUrlOutput {
  /** URL pré-assinada de download (`GET`); baixa o objeto direto do storage. */
  url: string;
  fileName: string;
  contentType: string;
  /** Segundos até a URL expirar. */
  expiresInSeconds: number;
}

/**
 * Caso de uso: gera uma URL pré-assinada para baixar um arquivo.
 *
 * Carrega o arquivo, confere a posse e assina uma URL de `GET` — os bytes vão
 * direto do storage ao cliente, sem passar pela aplicação. Somente leitura.
 */
export class GetFileDownloadUrl
  implements UseCase<GetFileDownloadUrlInput, GetFileDownloadUrlOutput>
{
  constructor(
    private readonly files: FileMetadataRepository,
    private readonly storage: ObjectStorage,
    private readonly presignExpiresInSeconds: number,
  ) {}

  async execute(
    input: GetFileDownloadUrlInput,
  ): Promise<GetFileDownloadUrlOutput> {
    const file = await this.files.findById(input.fileId);
    if (file === null) {
      throw new FileNotFoundError(input.fileId);
    }
    if (file.ownerId.value !== OwnerId.restore(input.ownerId).value) {
      throw new FileAccessDeniedError(input.fileId);
    }

    const url = await this.storage.presignDownload({
      key: file.storageKey.value,
      fileName: file.name.value,
      contentType: file.contentType.value,
      expiresInSeconds: this.presignExpiresInSeconds,
    });

    return {
      url,
      fileName: file.name.value,
      contentType: file.contentType.value,
      expiresInSeconds: this.presignExpiresInSeconds,
    };
  }
}
