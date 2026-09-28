import type { ListSort } from "../../../shared/application/list-sort";
import type { UseCase } from "../../../shared/application/use-case";
import { FolderAccessDeniedError } from "../../domain/errors/folder-access-denied.error";
import { FolderNotFoundError } from "../../domain/errors/folder-not-found.error";
import { ParentFolderNotFoundError } from "../../domain/errors/parent-folder-not-found.error";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { FolderRepository } from "../../domain/repositories/folder-repository";
import { OwnerId } from "../../domain/value-objects/owner-id";

export interface ListFolderContentsInput {
  ownerId: string;
  /** Pasta a listar. Se omitida, lista a raiz do usuário. */
  folderId?: string;
  sort: ListSort;
}

export interface FolderSummary {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileSummary {
  id: string;
  name: string;
  contentType: string;
  size: number;
  folderId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListFolderContentsOutput {
  /** Id da pasta efetivamente listada (a resolvida, quando veio a raiz). */
  folderId: string;
  folders: FolderSummary[];
  files: FileSummary[];
}

/**
 * Caso de uso: lista o CONTEÚDO de uma pasta — subpastas E arquivos, juntos.
 *
 * Um único caso de uso porque pastas e arquivos são o mesmo contexto (`drive`):
 * resolve a pasta-alvo (a informada ou a raiz), confere a posse e lê os dois
 * repositórios já ordenados conforme `sort`.
 */
export class ListFolderContents
  implements UseCase<ListFolderContentsInput, ListFolderContentsOutput>
{
  constructor(
    private readonly folders: FolderRepository,
    private readonly files: FileMetadataRepository,
  ) {}

  async execute(
    input: ListFolderContentsInput,
  ): Promise<ListFolderContentsOutput> {
    const ownerId = OwnerId.restore(input.ownerId).value;
    const targetId = await this.resolveTargetId(ownerId, input.folderId);

    const [folders, files] = await Promise.all([
      this.folders.findChildren(targetId, ownerId, input.sort),
      this.files.findByFolderId(targetId, ownerId, input.sort),
    ]);

    return {
      folderId: targetId,
      folders: folders.map((folder) => ({
        id: folder.id.value,
        name: folder.name.value,
        parentId: folder.parentId?.value ?? null,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      })),
      files: files.map((file) => ({
        id: file.id.value,
        name: file.name.value,
        contentType: file.contentType.value,
        size: file.size.bytes,
        folderId: file.folderId.value,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      })),
    };
  }

  private async resolveTargetId(
    ownerId: string,
    folderId: string | undefined,
  ): Promise<string> {
    if (folderId === undefined) {
      const root = await this.folders.findRootByOwnerId(ownerId);
      if (root === null) {
        throw new ParentFolderNotFoundError("root");
      }
      return root.id.value;
    }
    const folder = await this.folders.findById(folderId);
    if (folder === null) {
      throw new FolderNotFoundError(folderId);
    }
    if (folder.ownerId.value !== ownerId) {
      throw new FolderAccessDeniedError(folderId);
    }
    return folder.id.value;
  }
}
