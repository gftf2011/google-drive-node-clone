import type { EventHandler } from "../../../shared/application/event-handler";
import type { DomainEvent } from "../../../shared/domain/events/domain-event";
import type { PurgeFilesInFolders } from "../use-cases/purge-files-in-folders.use-case";

/**
 * Contrato mínimo que este handler espera do evento — definido AQUI (no
 * consumidor) para não acoplar o contexto `files` ao concreto `FolderDeleted` do
 * contexto `folders`. Qualquer evento que carregue `folderIds` o satisfaz.
 */
interface FolderDeletedLike extends DomainEvent {
  readonly folderIds: readonly string[];
}

/**
 * Apaga os arquivos das pastas removidas quando uma pasta é deletada em
 * `folders`. Depende apenas do contrato abstrato `DomainEvent` (+ `folderIds`);
 * a ligação ao evento concreto é feita por nome no composition root.
 */
export class PurgeFilesOnFolderDeleted implements EventHandler {
  constructor(private readonly purgeFilesInFolders: PurgeFilesInFolders) {}

  async handle(event: DomainEvent): Promise<void> {
    const { folderIds } = event as FolderDeletedLike;
    await this.purgeFilesInFolders.execute({ folderIds });
  }
}
