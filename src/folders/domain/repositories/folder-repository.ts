import type { Folder } from "../aggregates/folder";

/**
 * Contrato de persistência do agregado Folder — parte do DOMÍNIO.
 * A implementação concreta (Prisma, in-memory) vive na infra.
 */
export interface FolderRepository {
  /** Indica se o dono já possui uma pasta raiz (usado para idempotência). */
  existsRootByOwnerId(ownerId: string): Promise<boolean>;

  /** Persiste uma pasta (nova ou já existente). */
  save(folder: Folder): Promise<void>;
}
