import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidOwnerIdError extends DomainError {
  readonly code = "INVALID_OWNER_ID";

  constructor(raw: string) {
    super(`O identificador do dono é inválido: "${raw}".`);
  }
}
