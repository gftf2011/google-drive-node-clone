import { InvalidContentHashError } from "../errors/invalid-content-hash.error";

/** SHA-256 em hexadecimal: 64 caracteres [0-9a-f]. */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Hash do CONTEÚDO do documento (SHA-256 dos bytes do objeto). É a chave de
 * deduplicação da ingestão: dois arquivos com o mesmo hash têm o mesmo conteúdo
 * extraído, então o segundo é marcado como `duplicate` e reaproveita o artefato
 * do primeiro — nunca reprocessamos os mesmos bytes.
 */
export class ContentHash {
  private constructor(public readonly value: string) {}

  static create(raw: string): ContentHash {
    const normalized = raw.trim().toLowerCase();
    if (!SHA256_HEX.test(normalized)) {
      throw new InvalidContentHashError(raw);
    }
    return new ContentHash(normalized);
  }

  equals(other: ContentHash): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
