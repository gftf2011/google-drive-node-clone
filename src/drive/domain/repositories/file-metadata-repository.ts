import type { ListSort } from "../../../shared/application/list-sort";
import type { FileMetadata } from "../aggregates/file-metadata";

/**
 * Contrato de persistência do agregado FileMetadata — parte do DOMÍNIO.
 * A implementação concreta (ex.: Prisma) vive na infra.
 */
export interface FileMetadataRepository {
  /** Busca um arquivo por id; `null` se não existir. */
  findById(id: string): Promise<FileMetadata | null>;

  /** Soma, em bytes, o tamanho de todos os arquivos do dono (uso de cota). */
  sumSizeByOwnerId(ownerId: string): Promise<number>;

  /** Persiste um arquivo (novo ou já existente). */
  save(file: FileMetadata): Promise<void>;

  /** Arquivos de uma pasta, ordenados conforme `sort`. */
  findByFolderId(
    folderId: string,
    ownerId: string,
    sort: ListSort,
  ): Promise<FileMetadata[]>;

  /** Arquivos contidos em qualquer uma das pastas informadas. */
  findByFolderIds(folderIds: readonly string[]): Promise<FileMetadata[]>;

  /** Remove em lote os arquivos contidos nas pastas informadas. */
  deleteByFolderIds(folderIds: readonly string[]): Promise<void>;
}
