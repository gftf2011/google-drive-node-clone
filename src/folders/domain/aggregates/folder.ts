import { AggregateRoot } from "../../../shared/domain/aggregates/aggregate-root";
import { CannotModifyRootFolderError } from "../errors/cannot-modify-root-folder.error";
import { InvalidFolderHierarchyError } from "../errors/invalid-folder-hierarchy.error";
import { FolderId } from "../value-objects/folder-id";
import { FolderName } from "../value-objects/folder-name";
import { OwnerId } from "../value-objects/owner-id";

/** Nome padrão da pasta raiz de cada usuário. */
const ROOT_FOLDER_NAME = "root";

interface FolderProps {
  name: FolderName;
  ownerId: OwnerId;
  parentId: FolderId | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raiz do agregado Folder — um nó na árvore de pastas do usuário.
 *
 * A raiz do Drive é a pasta sem pai (`parentId === null`). Referencia o dono e
 * o pai apenas por identidade (nunca por objeto), mantendo o agregado pequeno e
 * os contextos desacoplados.
 */
export class Folder extends AggregateRoot<FolderId> {
  private constructor(id: FolderId, private props: FolderProps) {
    super(id);
  }

  /** Cria a pasta raiz de um usuário (sem pai). */
  static createRoot(props: { ownerId: string }): Folder {
    const now = new Date();
    return new Folder(FolderId.create(), {
      name: FolderName.create(ROOT_FOLDER_NAME),
      ownerId: OwnerId.restore(props.ownerId),
      parentId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Cria uma subpasta (exige um pai). */
  static create(props: { name: string; ownerId: string; parentId: string }): Folder {
    const now = new Date();
    return new Folder(FolderId.create(), {
      name: FolderName.create(props.name),
      ownerId: OwnerId.restore(props.ownerId),
      parentId: FolderId.restore(props.parentId),
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Reconstrói uma pasta existente a partir da persistência. */
  static restore(props: {
    id: string;
    name: string;
    ownerId: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Folder {
    return new Folder(FolderId.restore(props.id), {
      name: FolderName.create(props.name),
      ownerId: OwnerId.restore(props.ownerId),
      parentId: props.parentId === null ? null : FolderId.restore(props.parentId),
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  get name(): FolderName {
    return this.props.name;
  }

  get ownerId(): OwnerId {
    return this.props.ownerId;
  }

  get parentId(): FolderId | null {
    return this.props.parentId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isRoot(): boolean {
    return this.props.parentId === null;
  }

  rename(name: string): void {
    if (this.isRoot) {
      throw new CannotModifyRootFolderError(this.id.value);
    }
    const next = FolderName.create(name);
    if (this.props.name.equals(next)) {
      return;
    }
    this.props.name = next;
    this.props.updatedAt = new Date();
  }

  moveTo(parentId: string): void {
    if (this.isRoot) {
      throw new CannotModifyRootFolderError(this.id.value);
    }
    const next = FolderId.restore(parentId);
    if (next.equals(this.id)) {
      throw new InvalidFolderHierarchyError(
        "Uma pasta não pode ser pai de si mesma.",
      );
    }
    if (this.props.parentId !== null && this.props.parentId.equals(next)) {
      return;
    }
    this.props.parentId = next;
    this.props.updatedAt = new Date();
  }
}
