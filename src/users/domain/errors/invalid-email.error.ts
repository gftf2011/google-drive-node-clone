import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidEmailError extends DomainError {
  readonly code = "INVALID_EMAIL";

  constructor(raw: string) {
    super(`O e-mail informado é inválido: "${raw}".`);
  }
}
