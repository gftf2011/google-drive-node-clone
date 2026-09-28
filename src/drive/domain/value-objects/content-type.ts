import { InvalidContentTypeError } from "../errors/invalid-content-type.error";

/** Formato mínimo de um media type: "type/subtype" (ex.: "image/png"). */
const MEDIA_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const MAX_LENGTH = 255;

/**
 * Media type (MIME) do arquivo — o que será gravado como `Content-Type` do
 * objeto no storage. Validamos apenas o FORMATO; a veracidade do conteúdo é
 * responsabilidade de outra camada (ex.: verificação por magic bytes).
 */
export class ContentType {
  private constructor(public readonly value: string) {}

  static create(raw: string): ContentType {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length > MAX_LENGTH || !MEDIA_TYPE.test(normalized)) {
      throw new InvalidContentTypeError(raw);
    }
    return new ContentType(normalized);
  }

  equals(other: ContentType): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
