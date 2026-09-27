import { InvalidEmailError } from "../errors/invalid-email.error";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * E-mail do usuário. Normalizado (trim + lowercase) e validado por formato.
 * Unicidade NÃO é responsabilidade deste VO — depende de consultar o
 * repositório e é verificada no caso de uso.
 */
export class Email {
  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) {
      throw new InvalidEmailError(raw);
    }
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
