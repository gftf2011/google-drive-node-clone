import { DomainError } from "../../../shared/domain/errors/domain-error";

export class FileNotFoundError extends DomainError {
  readonly code = "FILE_NOT_FOUND";

  constructor(id: string) {
    super(`O arquivo não foi encontrado: "${id}".`);
  }
}
