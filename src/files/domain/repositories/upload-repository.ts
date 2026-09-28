import type { Upload } from "../aggregates/upload";

/**
 * Contrato de persistência do agregado Upload — parte do DOMÍNIO.
 * A implementação concreta (ex.: Prisma) vive na infra.
 */
export interface UploadRepository {
  /** Busca um upload por id; `null` se não existir. */
  findById(id: string): Promise<Upload | null>;

  /** Persiste um upload (novo ou já existente). */
  save(upload: Upload): Promise<void>;
}
