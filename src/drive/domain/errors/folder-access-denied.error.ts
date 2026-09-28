import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * A pasta existe, mas pertence a outro usuário. Falha de AUTORIZAÇÃO (403),
 * distinta de "não encontrada" (404).
 */
export class FolderAccessDeniedError extends DomainError {
  readonly code = "FOLDER_ACCESS_DENIED";

  constructor(id: string) {
    super(`A pasta "${id}" não pertence a este usuário.`);
  }
}
