import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidContentTypeError extends DomainError {
  readonly code = "INVALID_CONTENT_TYPE";

  constructor(raw: string) {
    super(`O tipo de conteúdo (MIME) é inválido: "${raw}".`);
  }
}
