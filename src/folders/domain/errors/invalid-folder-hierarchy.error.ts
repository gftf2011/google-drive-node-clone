import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/**
 * A operação violaria a hierarquia de pastas (ex.: uma pasta como pai de si
 * mesma). Ciclos mais profundos (mover para dentro da própria descendência)
 * dependem da árvore e são checados no caso de uso.
 */
export class InvalidFolderHierarchyError extends DomainError {
  readonly code = "INVALID_FOLDER_HIERARCHY";

  constructor(message: string) {
    super(message);
  }
}
