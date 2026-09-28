import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidPartNumberError extends DomainError {
  readonly code = "INVALID_PART_NUMBER";

  constructor(raw: number) {
    super(`O número da parte é inválido: ${raw} (esperado entre 1 e 10000).`);
  }
}
