import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * Tentativa de completar um upload que já não está em andamento — porque já foi
 * concluído. Protege o invariante do agregado: a transição só é válida a partir
 * do estado `pending`.
 */
export class UploadNotPendingError extends DomainError {
  readonly code = "UPLOAD_NOT_PENDING";

  constructor(id: string, status: string) {
    super(`O upload "${id}" não está em andamento (estado atual: ${status}).`);
  }
}
