import { InvalidFolderNameError } from "../errors/invalid-folder-name.error";

const MIN_LENGTH = 1;
const MAX_LENGTH = 255;
const RESERVED = new Set([".", ".."]);
// Separadores de caminho não são permitidos em um nome de pasta.
const PATH_SEPARATOR = /[/\\]/;

/** Rejeita caracteres de controle (inclusive o nulo) sem embutir escapes no fonte. */
function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}

/**
 * Nome de uma pasta. Imutável e sempre válido por construção.
 */
export class FolderName {
  private constructor(public readonly value: string) {}

  static create(raw: string): FolderName {
    const normalized = raw.trim();
    if (
      normalized.length < MIN_LENGTH ||
      normalized.length > MAX_LENGTH ||
      RESERVED.has(normalized) ||
      PATH_SEPARATOR.test(normalized) ||
      hasControlCharacter(normalized)
    ) {
      throw new InvalidFolderNameError(raw);
    }
    return new FolderName(normalized);
  }

  equals(other: FolderName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
