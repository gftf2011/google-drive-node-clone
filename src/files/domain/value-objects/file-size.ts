import { InvalidFileSizeError } from "../errors/invalid-file-size.error";

/** Limite de um objeto no S3: 5 TiB. */
const MAX_BYTES = 5 * 1024 ** 4;

/**
 * Tamanho declarado do arquivo, em bytes.
 *
 * É o tamanho que o cliente ANUNCIA ao iniciar o upload — usado para validar
 * cedo (arquivo vazio, ou acima do teto do S3) e como metadado. A verificação
 * do tamanho real gravado é feita ao completar o upload, no storage.
 *
 * Cabe com folga num `number` (o teto é ~5,5e12, bem abaixo de
 * `Number.MAX_SAFE_INTEGER`).
 */
export class FileSize {
  private constructor(public readonly bytes: number) {}

  static create(raw: number): FileSize {
    if (!Number.isInteger(raw) || raw <= 0 || raw > MAX_BYTES) {
      throw new InvalidFileSizeError(raw);
    }
    return new FileSize(raw);
  }

  equals(other: FileSize): boolean {
    return this.bytes === other.bytes;
  }
}
