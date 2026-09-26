const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Base de Value Objects de identidade baseados em UUID.
 *
 * Concentra a normalização e a validação de formato; cada id concreto (ex.:
 * `FolderId`, `OwnerId`) herda daqui e lança o próprio erro de domínio, mantendo
 * a tipagem forte de cada contexto.
 */
export abstract class Uuid {
  protected constructor(public readonly value: string) {}

  protected static normalize(raw: string): string {
    return raw.trim().toLowerCase();
  }

  protected static isValid(value: string): boolean {
    return UUID_REGEX.test(value);
  }

  equals(other: Uuid): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
