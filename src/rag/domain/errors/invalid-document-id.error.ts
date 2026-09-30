import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidDocumentIdError extends DomainError {
  readonly code = "INVALID_DOCUMENT_ID";

  constructor(raw: string) {
    super(`O id do documento de ingestão é inválido: "${raw}".`);
  }
}
