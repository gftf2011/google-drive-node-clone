import { Uuid } from "../../../shared/domain/value-objects/uuid.js";
import { InvalidOwnerIdError } from "../errors/invalid-owner-id.error.js";

/**
 * Referência ao usuário dono da pasta, por identidade.
 *
 * É o elo com o contexto `users` sem acoplamento: o `folders` só conhece o id,
 * nunca o agregado `User`. Por isso há apenas `restore` — um dono nunca é
 * "gerado" aqui; ele já existe no outro contexto.
 */
export class OwnerId extends Uuid {
  static restore(raw: string): OwnerId {
    const normalized = Uuid.normalize(raw);
    if (!Uuid.isValid(normalized)) {
      throw new InvalidOwnerIdError(raw);
    }
    return new OwnerId(normalized);
  }
}
