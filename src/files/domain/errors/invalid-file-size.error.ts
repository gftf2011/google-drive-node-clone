import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidFileSizeError extends DomainError {
  readonly code = "INVALID_FILE_SIZE";

  constructor(raw: number) {
    super(`O tamanho do arquivo é inválido: ${raw} bytes.`);
  }
}
