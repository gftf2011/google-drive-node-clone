import { DomainError } from "../../../shared/domain/errors/domain-error";

export class UploadNotFoundError extends DomainError {
  readonly code = "UPLOAD_NOT_FOUND";

  constructor(id: string) {
    super(`Upload não encontrado: "${id}".`);
  }
}
