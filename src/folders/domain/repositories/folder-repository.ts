import type { Folder } from "../aggregates/folder";

/**
 * Contrato de persistência do agregado Folder — parte do DOMÍNIO.
 * A implementação concreta (ex.: Prisma) vive na infra.
 */
export interface FolderRepository {
  /** Indica se o dono já possui uma pasta raiz (usado para idempotência). */
  existsRootByOwnerId(ownerId: string): Promise<boolean>;

  /** Busca uma pasta por id; `null` se não existir. */
  findById(id: string): Promise<Folder | null>;

  /** Busca a pasta raiz de um dono (pai nulo); `null` se ainda não existir. */
  findRootByOwnerId(ownerId: string): Promise<Folder | null>;

  /** Todas as pastas de um dono (usado para percorrer a árvore em memória). */
  findByOwnerId(ownerId: string): Promise<Folder[]>;

  /** Persiste uma pasta (nova ou já existente). */
  save(folder: Folder): Promise<void>;

  /** Remove em lote as pastas com os ids informados. */
  deleteByIds(ids: readonly string[]): Promise<void>;
}
