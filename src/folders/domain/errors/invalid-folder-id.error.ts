import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export class InvalidFolderIdError extends DomainError {
  readonly code = "INVALID_FOLDER_ID";

  constructor(raw: string) {
    super(`O identificador de pasta é inválido: "${raw}".`);
  }
}
