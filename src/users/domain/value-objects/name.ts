import { InvalidNameError } from "../errors/invalid-name.error.js";

const MIN_LENGTH = 2;
const MAX_LENGTH = 100;

/**
 * Nome de exibição do usuário. Imutável e sempre válido por construção.
 */
export class Name {
  private constructor(public readonly value: string) {}

  static create(raw: string): Name {
    const normalized = raw.trim().replace(/\s+/g, " ");
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new InvalidNameError(raw);
    }
    return new Name(normalized);
  }

  equals(other: Name): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
