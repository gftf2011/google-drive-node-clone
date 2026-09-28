import { AggregateRoot } from "../../../shared/domain/aggregates/aggregate-root";
import { ContentType } from "../value-objects/content-type";
import { FileId } from "../value-objects/file-id";
import { FileName } from "../value-objects/file-name";
import { FileSize } from "../value-objects/file-size";
import { FolderId } from "../value-objects/folder-id";
import { OwnerId } from "../value-objects/owner-id";
import { StorageKey } from "../value-objects/storage-key";

interface FileMetadataProps {
  ownerId: OwnerId;
  folderId: FolderId;
  name: FileName;
  contentType: ContentType;
  size: FileSize;
  storageKey: StorageKey;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raiz do agregado FileMetadata — o ARQUIVO no Drive, como o usuário o vê e
 * manipula (lista, renomeia, move). Durável, ao contrário do `Upload`, que é só
 * a sessão efêmera de transferência.
 *
 * Nasce quando um multipart upload é concluído: herda do `Upload` a `storageKey`
 * (o vínculo com o objeto no S3) e os metadados, e passa a viver associado a uma
 * pasta (`folderId`). Referencia dono e pasta apenas por identidade (contextos
 * `users`/`folders` desacoplados).
 */
export class FileMetadata extends AggregateRoot<FileId> {
  private constructor(id: FileId, private props: FileMetadataProps) {
    super(id);
  }

  /** Cria um novo arquivo (ex.: ao concluir um upload). */
  static create(props: {
    ownerId: string;
    folderId: string;
    name: string;
    contentType: string;
    size: number;
    storageKey: string;
  }): FileMetadata {
    const now = new Date();
    return new FileMetadata(FileId.create(), {
      ownerId: OwnerId.restore(props.ownerId),
      folderId: FolderId.restore(props.folderId),
      name: FileName.create(props.name),
      contentType: ContentType.create(props.contentType),
      size: FileSize.create(props.size),
      storageKey: StorageKey.restore(props.storageKey),
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Reconstrói um arquivo existente a partir da persistência. */
  static restore(props: {
    id: string;
    ownerId: string;
    folderId: string;
    name: string;
    contentType: string;
    size: number;
    storageKey: string;
    createdAt: Date;
    updatedAt: Date;
  }): FileMetadata {
    return new FileMetadata(FileId.restore(props.id), {
      ownerId: OwnerId.restore(props.ownerId),
      folderId: FolderId.restore(props.folderId),
      name: FileName.create(props.name),
      contentType: ContentType.create(props.contentType),
      size: FileSize.create(props.size),
      storageKey: StorageKey.restore(props.storageKey),
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  get ownerId(): OwnerId {
    return this.props.ownerId;
  }

  get folderId(): FolderId {
    return this.props.folderId;
  }

  get name(): FileName {
    return this.props.name;
  }

  get contentType(): ContentType {
    return this.props.contentType;
  }

  get size(): FileSize {
    return this.props.size;
  }

  get storageKey(): StorageKey {
    return this.props.storageKey;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
