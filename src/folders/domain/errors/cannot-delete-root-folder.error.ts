import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * A pasta raiz do usuário não pode ser deletada — ela é o topo da árvore do
 * Drive e existe enquanto o usuário existir.
 */
export class CannotDeleteRootFolderError extends DomainError {
  readonly code = "CANNOT_DELETE_ROOT_FOLDER";

  constructor(folderId: string) {
    super(`A pasta raiz (${folderId}) não pode ser deletada.`);
  }
}
