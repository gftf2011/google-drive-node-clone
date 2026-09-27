import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidFolderNameError extends DomainError {
  readonly code = "INVALID_FOLDER_NAME";

  constructor(raw: string) {
    super(`O nome de pasta é inválido: "${raw}".`);
  }
}
