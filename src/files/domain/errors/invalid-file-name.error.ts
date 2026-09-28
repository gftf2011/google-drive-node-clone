import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidFileNameError extends DomainError {
  readonly code = "INVALID_FILE_NAME";

  constructor(raw: string) {
    super(`O nome do arquivo é inválido: "${raw}".`);
  }
}
