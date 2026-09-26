import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export class InvalidNameError extends DomainError {
  readonly code = "INVALID_NAME";

  constructor(raw: string) {
    super(`O nome informado é inválido: "${raw}".`);
  }
}
