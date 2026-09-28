import type { DomainEvent } from "../../../shared/domain/events/domain-event";

/**
 * Fato de domínio: uma pasta (e toda a sua subárvore) foi removida.
 *
 * Carrega os ids de TODAS as pastas removidas — a raiz da operação e suas
 * descendentes — para que outros contextos reajam. Em particular, o contexto
 * `files` observa este evento e apaga os arquivos (e os objetos no storage)
 * contidos nessas pastas. O domínio `folders` não conhece esse efeito; apenas
 * anuncia o fato.
 */
export class FolderDeleted implements DomainEvent {
  static readonly EVENT_NAME = "folders.folder-deleted";

  readonly eventName = FolderDeleted.EVENT_NAME;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  /** Ids de todas as pastas removidas (a própria e as descendentes). */
  readonly folderIds: readonly string[];

  constructor(rootFolderId: string, folderIds: readonly string[], occurredAt: Date) {
    this.aggregateId = rootFolderId;
    this.folderIds = folderIds;
    this.occurredAt = occurredAt;
  }
}
