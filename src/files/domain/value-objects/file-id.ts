import { randomUUID } from "node:crypto";

import { Uuid } from "../../../shared/domain/value-objects/uuid";
import { InvalidFileIdError } from "../errors/invalid-file-id.error";

/** Identidade do agregado FileMetadata (o arquivo no Drive). */
export class FileId extends Uuid {
  /** Gera um novo identificador (arquivo ainda não persistido). */
  static create(): FileId {
    return new FileId(randomUUID());
  }

  /** Reconstrói a partir de um valor existente (ex.: vindo do banco). */
  static restore(raw: string): FileId {
    const normalized = Uuid.normalize(raw);
    if (!Uuid.isValid(normalized)) {
      throw new InvalidFileIdError(raw);
    }
    return new FileId(normalized);
  }
}
