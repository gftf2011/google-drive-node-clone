import { randomUUID } from "node:crypto";

import { Uuid } from "../../../shared/domain/value-objects/uuid";
import { InvalidUploadIdError } from "../errors/invalid-upload-id.error";

/** Identidade do agregado Upload (a sessão de multipart upload). */
export class UploadId extends Uuid {
  /** Gera um novo identificador (upload ainda não persistido). */
  static create(): UploadId {
    return new UploadId(randomUUID());
  }

  /** Reconstrói a partir de um valor existente (ex.: vindo do banco). */
  static restore(raw: string): UploadId {
    const normalized = Uuid.normalize(raw);
    if (!Uuid.isValid(normalized)) {
      throw new InvalidUploadIdError(raw);
    }
    return new UploadId(normalized);
  }
}
