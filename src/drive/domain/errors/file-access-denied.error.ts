import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * O arquivo existe, mas pertence a outro usuário. Falha de AUTORIZAÇÃO (403),
 * distinta de "não encontrado" (404).
 */
export class FileAccessDeniedError extends DomainError {
  readonly code = "FILE_ACCESS_DENIED";

  constructor(id: string) {
    super(`O arquivo "${id}" não pertence a este usuário.`);
  }
}
