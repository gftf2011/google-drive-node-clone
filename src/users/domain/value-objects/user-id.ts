import { randomUUID } from "node:crypto";

import { InvalidUserIdError } from "../errors/invalid-user-id.error.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identidade do agregado User. Um Value Object imutável em torno de um UUID.
 */
export class UserId {
  private constructor(public readonly value: string) {}

  /** Gera um novo identificador (usuário ainda não persistido). */
  static create(): UserId {
    return new UserId(randomUUID());
  }

  /** Reconstrói a partir de um valor já existente (ex.: vindo do banco). */
  static restore(raw: string): UserId {
    const normalized = raw.trim().toLowerCase();
    if (!UUID_REGEX.test(normalized)) {
      throw new InvalidUserIdError(raw);
    }
    return new UserId(normalized);
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
