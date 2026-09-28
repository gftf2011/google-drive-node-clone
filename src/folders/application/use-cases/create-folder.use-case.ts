import type { UseCase } from "../../../shared/application/use-case";
import { Folder } from "../../domain/aggregates/folder";
import { FolderAccessDeniedError } from "../../domain/errors/folder-access-denied.error";
import { ParentFolderNotFoundError } from "../../domain/errors/parent-folder-not-found.error";
import type { FolderRepository } from "../../domain/repositories/folder-repository";
import { OwnerId } from "../../domain/value-objects/owner-id";

export interface CreateFolderInput {
  ownerId: string;
  name: string;
  /**
   * Pasta onde a nova subpasta será criada. Se omitida, usa-se a pasta raiz do
   * usuário (criada no cadastro) — assim o cliente cria pastas sem conhecer o id
   * da raiz.
   */
  parentId?: string;
}

export interface CreateFolderOutput {
  folderId: string;
  name: string;
  parentId: string;
}

/**
 * Caso de uso: cria uma subpasta para o usuário.
 *
 * Resolve o pai antes de criar: um `parentId` explícito precisa existir E
 * pertencer ao dono; sem `parentId`, cai na raiz do usuário. Só então cria a
 * pasta (o `FolderName` valida o nome no próprio agregado) e persiste — uma
 * única escrita, sem necessidade de Unit of Work.
 */
export class CreateFolder
  implements UseCase<CreateFolderInput, CreateFolderOutput>
{
  constructor(private readonly folders: FolderRepository) {}

  async execute(input: CreateFolderInput): Promise<CreateFolderOutput> {
    const parent = await this.resolveParent(input.ownerId, input.parentId);

    const folder = Folder.create({
      name: input.name,
      ownerId: input.ownerId,
      parentId: parent.id.value,
    });
    await this.folders.save(folder);

    return {
      folderId: folder.id.value,
      name: folder.name.value,
      parentId: parent.id.value,
    };
  }

  private async resolveParent(
    ownerId: string,
    parentId: string | undefined,
  ): Promise<Folder> {
    if (parentId === undefined) {
      const root = await this.folders.findRootByOwnerId(ownerId);
      if (root === null) {
        throw new ParentFolderNotFoundError("root");
      }
      return root;
    }

    const parent = await this.folders.findById(parentId);
    if (parent === null) {
      throw new ParentFolderNotFoundError(parentId);
    }
    if (parent.ownerId.value !== OwnerId.restore(ownerId).value) {
      throw new FolderAccessDeniedError(parentId);
    }
    return parent;
  }
}
