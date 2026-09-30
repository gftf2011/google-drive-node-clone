import type { DomainEvent } from "../../../shared/domain/events/domain-event";
import type { FileId } from "../value-objects/file-id";

/**
 * Fato de domínio: um arquivo foi criado no Drive (ao concluir um upload).
 *
 * Diferente do `UserCreated` — que carrega só a identidade —, este evento leva
 * também os metadados do arquivo. O contexto `rag` reage a ele para ENFILEIRAR a
 * ingestão do documento, e precisa de `storageKey`/`contentType`/etc. para isso
 * SEM consultar o repositório de `drive` (contextos desacoplados). O evento é,
 * portanto, um carregador de dados autocontido: o `rag` conhece apenas este DTO,
 * nunca o agregado `FileMetadata`.
 */
export class FileCreated implements DomainEvent {
  static readonly EVENT_NAME = "drive.file-created";

  readonly eventName = FileCreated.EVENT_NAME;
  readonly occurredAt: Date;
  readonly aggregateId: string;

  readonly ownerId: string;
  readonly folderId: string;
  readonly storageKey: string;
  readonly contentType: string;
  readonly fileName: string;
  /** SHA-256 (hex) do arquivo, quando o cliente o informou no upload. */
  readonly contentHash?: string;

  constructor(props: {
    fileId: FileId;
    ownerId: string;
    folderId: string;
    storageKey: string;
    contentType: string;
    fileName: string;
    contentHash?: string;
    occurredAt: Date;
  }) {
    this.aggregateId = props.fileId.value;
    this.ownerId = props.ownerId;
    this.folderId = props.folderId;
    this.storageKey = props.storageKey;
    this.contentType = props.contentType;
    this.fileName = props.fileName;
    this.contentHash = props.contentHash;
    this.occurredAt = props.occurredAt;
  }
}
