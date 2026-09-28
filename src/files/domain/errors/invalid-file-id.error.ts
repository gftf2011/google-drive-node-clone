import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidFileIdError extends DomainError {
  readonly code = "INVALID_FILE_ID";

  constructor(raw: string) {
    super(`O identificador do arquivo é inválido: "${raw}".`);
  }
}
