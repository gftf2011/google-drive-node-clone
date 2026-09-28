import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * A pasta-pai informada (ou a raiz do usuário) não existe. Impede criar uma
 * subpasta pendurada em um pai inexistente.
 */
export class ParentFolderNotFoundError extends DomainError {
  readonly code = "PARENT_FOLDER_NOT_FOUND";

  constructor(id: string) {
    super(`A pasta-pai não foi encontrada: "${id}".`);
  }
}
