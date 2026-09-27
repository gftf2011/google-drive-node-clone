import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidPasswordError extends DomainError {
  readonly code = "INVALID_PASSWORD";

  constructor(message = "O hash de senha informado é inválido.") {
    super(message);
  }
}
