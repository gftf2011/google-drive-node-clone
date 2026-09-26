import { randomUUID } from "node:crypto";

import { Uuid } from "../../../shared/domain/value-objects/uuid.js";
import { InvalidFolderIdError } from "../errors/invalid-folder-id.error.js";

/** Identidade do agregado Folder. */
export class FolderId extends Uuid {
  /** Gera um novo identificador (pasta ainda não persistida). */
  static create(): FolderId {
    return new FolderId(randomUUID());
  }

  /** Reconstrói a partir de um valor existente (ex.: vindo do banco). */
  static restore(raw: string): FolderId {
    const normalized = Uuid.normalize(raw);
    if (!Uuid.isValid(normalized)) {
      throw new InvalidFolderIdError(raw);
    }
    return new FolderId(normalized);
  }
}
