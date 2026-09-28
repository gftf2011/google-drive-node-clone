import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidUploadIdError extends DomainError {
  readonly code = "INVALID_UPLOAD_ID";

  constructor(raw: string) {
    super(`O identificador do upload é inválido: "${raw}".`);
  }
}
