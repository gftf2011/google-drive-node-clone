import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidUserIdError extends DomainError {
  readonly code = "INVALID_USER_ID";

  constructor(raw: string) {
    super(`O identificador de usuário é inválido: "${raw}".`);
  }
}
