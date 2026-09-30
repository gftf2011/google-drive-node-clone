import { Uuid } from "../../../shared/domain/value-objects/uuid";
import { InvalidDocumentIdError } from "../errors/invalid-document-id.error";

/**
 * Identidade do documento de ingestão. É o MESMO id do `FileMetadata` que o
 * originou (relação 1:1 arquivo↔ingestão) — o contexto `rag` só o conhece como
 * um uuid, sem depender do agregado do `drive`.
 */
export class DocumentId extends Uuid {
  static restore(raw: string): DocumentId {
    const normalized = Uuid.normalize(raw);
    if (!Uuid.isValid(normalized)) {
      throw new InvalidDocumentIdError(raw);
    }
    return new DocumentId(normalized);
  }
}
