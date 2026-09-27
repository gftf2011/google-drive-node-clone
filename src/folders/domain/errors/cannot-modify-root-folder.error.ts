import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * A pasta raiz do usuário não pode ser renomeada nem movida — é o topo da
 * árvore do Drive e existe enquanto o usuário existir.
 */
export class CannotModifyRootFolderError extends DomainError {
  readonly code = "CANNOT_MODIFY_ROOT_FOLDER";

  constructor(folderId: string) {
    super(`A pasta raiz (${folderId}) não pode ser renomeada nem movida.`);
  }
}
