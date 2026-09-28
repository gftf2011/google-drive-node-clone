import { DomainError } from "../../../shared/domain/errors/domain-error";

export class FolderNotFoundError extends DomainError {
  readonly code = "FOLDER_NOT_FOUND";

  constructor(id: string) {
    super(`A pasta não foi encontrada: "${id}".`);
  }
}
