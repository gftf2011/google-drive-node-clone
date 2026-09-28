import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import type { UseCase } from "../../../shared/application/use-case";
import { FileMetadata } from "../../domain/aggregates/file-metadata";
import { EmptyPartsError } from "../../domain/errors/empty-parts.error";
import { InvalidPartNumberError } from "../../domain/errors/invalid-part-number.error";
import { UploadNotFoundError } from "../../domain/errors/upload-not-found.error";
import { UploadNotOwnedError } from "../../domain/errors/upload-not-owned.error";
import { UploadNotPendingError } from "../../domain/errors/upload-not-pending.error";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { UploadRepository } from "../../domain/repositories/upload-repository";
import { PartNumber } from "../../domain/value-objects/part-number";
import type {
  ObjectStorage,
  UploadedPart,
} from "../ports/storage/object-storage";

export interface CompleteMultipartUploadInput {
  uploadId: string;
  ownerId: string;
  parts: { partNumber: number; etag: string }[];
}

export interface CompleteMultipartUploadOutput {
  /** Id do arquivo criado no Drive (o agregado durável). */
  fileId: string;
  key: string;
  etag: string;
  location: string;
}

/**
 * Caso de uso: conclui um multipart upload e materializa o arquivo no Drive.
 *
 * Duas responsabilidades encadeadas:
 *   1. Pede ao storage que una as partes no objeto final (rede).
 *   2. Marca a sessão como concluída E cria o `FileMetadata` associado à pasta,
 *      no MESMO commit — ou tudo persiste, ou nada.
 *
 * A conclusão no storage acontece ANTES e FORA da transação de banco: seria ruim
 * manter uma transação aberta durante a chamada de rede. Por isso o caso de uso
 * gerencia a própria Unit of Work (em vez de ser decorado por fora): só as duas
 * escritas de banco entram na fronteira transacional.
 *
 * Idempotência: uma segunda chamada encontra o upload já concluído e cai em
 * `UploadNotPendingError`, evitando um `FileMetadata` duplicado.
 */
export class CompleteMultipartUpload
  implements
    UseCase<CompleteMultipartUploadInput, CompleteMultipartUploadOutput>
{
  constructor(
    private readonly uploads: UploadRepository,
    private readonly files: FileMetadataRepository,
    private readonly storage: ObjectStorage,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    input: CompleteMultipartUploadInput,
  ): Promise<CompleteMultipartUploadOutput> {
    const parts = this.normalizeParts(input.parts);

    const upload = await this.uploads.findById(input.uploadId);
    if (upload === null) {
      throw new UploadNotFoundError(input.uploadId);
    }
    if (!upload.belongsTo(input.ownerId)) {
      throw new UploadNotOwnedError(input.uploadId);
    }
    if (!upload.isPending || upload.storageUploadId === null) {
      throw new UploadNotPendingError(input.uploadId, upload.status);
    }

    const completed = await this.storage.completeMultipartUpload({
      key: upload.storageKey.value,
      storageUploadId: upload.storageUploadId,
      parts,
    });

    upload.complete();
    const file = FileMetadata.create({
      ownerId: upload.ownerId.value,
      folderId: upload.folderId.value,
      name: upload.fileName.value,
      contentType: upload.contentType.value,
      size: upload.size.bytes,
      storageKey: upload.storageKey.value,
    });

    // As duas escritas commitam juntas: o upload vira `completed` e o arquivo
    // passa a existir na pasta no mesmo instante.
    await this.unitOfWork.runInTransaction(async () => {
      await this.uploads.save(upload);
      await this.files.save(file);
    });

    return {
      fileId: file.id.value,
      key: upload.storageKey.value,
      etag: completed.etag,
      location: completed.location,
    };
  }

  /** Valida cada parte, rejeita duplicatas e ordena por número ascendente. */
  private normalizeParts(
    raw: { partNumber: number; etag: string }[],
  ): UploadedPart[] {
    if (raw.length === 0) {
      throw new EmptyPartsError();
    }
    const seen = new Set<number>();
    const parts = raw.map((part) => {
      const partNumber = PartNumber.create(part.partNumber).value;
      // Uma parte repetida tornaria o manifesto ambíguo — rejeita cedo.
      if (seen.has(partNumber)) {
        throw new InvalidPartNumberError(part.partNumber);
      }
      seen.add(partNumber);
      return { partNumber, etag: part.etag.trim() };
    });
    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }
}
