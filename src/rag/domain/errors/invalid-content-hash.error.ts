import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidContentHashError extends DomainError {
  readonly code = "INVALID_CONTENT_HASH";

  constructor(raw: string) {
    super(`O hash de conteúdo é inválido (esperado SHA-256 hex): "${raw}".`);
  }
}
