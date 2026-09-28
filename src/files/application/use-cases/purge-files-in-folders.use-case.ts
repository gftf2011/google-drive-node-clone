import type { UseCase } from "../../../shared/application/use-case";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { ObjectStorage } from "../ports/storage/object-storage";

export interface PurgeFilesInFoldersInput {
  folderIds: readonly string[];
}

/**
 * Caso de uso: apaga todos os arquivos contidos em um conjunto de pastas — os
 * registros (`FileMetadata`) e os objetos no storage.
 *
 * É o efeito, no contexto `files`, da remoção de uma pasta em `folders`. Remove
 * as linhas primeiro e, só então, apaga os objetos no S3 — best-effort: um
 * `DeleteObject` é idempotente e uma falha não deve reverter a remoção já feita
 * (no pior caso sobra um objeto órfão, inofensivo e coletável por lifecycle).
 */
export class PurgeFilesInFolders
  implements UseCase<PurgeFilesInFoldersInput, void>
{
  constructor(
    private readonly files: FileMetadataRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(input: PurgeFilesInFoldersInput): Promise<void> {
    if (input.folderIds.length === 0) {
      return;
    }

    // Coleta as chaves ANTES de remover as linhas (depois não haveria como sabê-las).
    const files = await this.files.findByFolderIds(input.folderIds);
    await this.files.deleteByFolderIds(input.folderIds);

    if (files.length === 0) {
      return;
    }
    try {
      // Remoção em lote (o adapter divide conforme o limite do provedor).
      await this.storage.deleteObjects({
        keys: files.map((file) => file.storageKey.value),
      });
    } catch {
      // Best-effort: objetos que não puderam ser removidos viram órfãos inofensivos.
    }
  }
}
