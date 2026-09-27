import { DomainError } from "../../../shared/domain/errors/domain-error";

export class WeakPasswordError extends DomainError {
  readonly code = "WEAK_PASSWORD";

  constructor(min: number, max: number) {
    super(`A senha deve ter entre ${min} e ${max} caracteres.`);
  }
}
