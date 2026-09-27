import { DomainError } from "../../../shared/domain/errors/domain-error";

export class EmailAlreadyInUseError extends DomainError {
  readonly code = "EMAIL_ALREADY_IN_USE";

  constructor(email: string) {
    super(`O e-mail "${email}" já está em uso.`);
  }
}
