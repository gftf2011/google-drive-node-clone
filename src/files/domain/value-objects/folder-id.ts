import { Uuid } from "../../../shared/domain/value-objects/uuid";
import { InvalidFolderIdError } from "../errors/invalid-folder-id.error";

/**
 * Referência à pasta onde o arquivo será colocado, por identidade.
 *
 * Elo com o contexto `folders` sem acoplamento: o `files` só conhece o id da
 * pasta de destino. Por isso há apenas `restore` — a pasta já existe alhures.
 */
export class FolderId extends Uuid {
  static restore(raw: string): FolderId {
    const normalized = Uuid.normalize(raw);
    if (!Uuid.isValid(normalized)) {
      throw new InvalidFolderIdError(raw);
    }
    return new FolderId(normalized);
  }
}
