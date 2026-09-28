import { Uuid } from "../../../shared/domain/value-objects/uuid";
import { InvalidOwnerIdError } from "../errors/invalid-owner-id.error";

/**
 * Referência ao usuário dono do upload, por identidade.
 *
 * Elo com o contexto `users` sem acoplamento: o `files` só conhece o id, nunca o
 * agregado `User`. Por isso há apenas `restore` — o dono já existe alhures.
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
