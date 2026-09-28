import type { FileMetadata } from "../aggregates/file-metadata";

/**
 * Contrato de persistência do agregado FileMetadata — parte do DOMÍNIO.
 * A implementação concreta (ex.: Prisma) vive na infra.
 */
export interface FileMetadataRepository {
  /** Persiste um arquivo (novo ou já existente). */
  save(file: FileMetadata): Promise<void>;

  /** Arquivos contidos em qualquer uma das pastas informadas. */
  findByFolderIds(folderIds: readonly string[]): Promise<FileMetadata[]>;

  /** Remove em lote os arquivos contidos nas pastas informadas. */
  deleteByFolderIds(folderIds: readonly string[]): Promise<void>;
}
