import { Folder } from "../../domain/aggregates/folder";
import type { FolderRepository } from "../../domain/repositories/folder-repository";

export interface CreateRootFolderInput {
  /** Id do usuário dono da pasta raiz (referência ao contexto `users`). */
  ownerId: string;
}

/**
 * Caso de uso: cria a pasta raiz de um usuário.
 *
 * É idempotente — se o dono já possui uma raiz, não cria outra. Isso torna
 * seguro reprocessar o evento que o dispara (entrega at-least-once).
 */
export class CreateRootFolder {
  constructor(private readonly folders: FolderRepository) {}

  async execute(input: CreateRootFolderInput): Promise<void> {
    if (await this.folders.existsRootByOwnerId(input.ownerId)) {
      return;
    }
    const root = Folder.createRoot({ ownerId: input.ownerId });
    await this.folders.save(root);
  }
}
