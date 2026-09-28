import type { FileName } from "./file-name";

/** Prefixo de todos os objetos de upload no bucket. */
const PREFIX = "uploads";

/** Troca por "_" tudo que não seja seguro/estável numa chave de objeto. */
function slugify(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe.length > 0 ? safe : "file";
}

/**
 * Chave (path) do objeto no bucket — a identidade do arquivo DENTRO do storage,
 * distinta do nome que o usuário vê (`FileName`).
 *
 * É derivada, nunca digitada: `uploads/{ownerId}/{uploadId}/{nome-seguro}`. O
 * `uploadId` no caminho garante unicidade (dois uploads do mesmo arquivo não
 * colidem) e isola os objetos por dono.
 */
export class StorageKey {
  private constructor(public readonly value: string) {}

  /** Constrói a chave a partir da identidade do upload e do nome do arquivo. */
  static build(props: {
    ownerId: string;
    uploadId: string;
    fileName: FileName;
  }): StorageKey {
    const key = `${PREFIX}/${props.ownerId}/${props.uploadId}/${slugify(
      props.fileName.value,
    )}`;
    return new StorageKey(key);
  }

  /** Reconstrói uma chave já existente (ex.: vinda do banco). */
  static restore(raw: string): StorageKey {
    return new StorageKey(raw);
  }

  equals(other: StorageKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
