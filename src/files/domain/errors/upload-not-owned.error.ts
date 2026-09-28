import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * O upload existe, mas pertence a outro usuário. Erro separado de "não
 * encontrado" no domínio; a borda pode escolher devolver 404 para não revelar
 * a existência do recurso, mas a intenção de negócio é distinta.
 */
export class UploadNotOwnedError extends DomainError {
  readonly code = "UPLOAD_NOT_OWNED";

  constructor(id: string) {
    super(`O upload "${id}" não pertence a este usuário.`);
  }
}
