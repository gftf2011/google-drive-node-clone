import { AggregateRoot } from "../../../shared/domain/aggregates/aggregate-root";
import { UploadNotPendingError } from "../errors/upload-not-pending.error";
import { ContentType } from "../value-objects/content-type";
import { FileName } from "../value-objects/file-name";
import { FileSize } from "../value-objects/file-size";
import { FolderId } from "../value-objects/folder-id";
import { OwnerId } from "../value-objects/owner-id";
import { StorageKey } from "../value-objects/storage-key";
import { UploadId } from "../value-objects/upload-id";

/** Estados do ciclo de vida de uma sessão de multipart upload. */
export type UploadStatus = "pending" | "completed";

interface UploadProps {
  ownerId: OwnerId;
  folderId: FolderId;
  fileName: FileName;
  contentType: ContentType;
  size: FileSize;
  storageKey: StorageKey;
  /**
   * Id do multipart upload NO STORAGE (o `UploadId` do S3). É nulo entre a
   * abertura do agregado e a criação da sessão no storage; a partir daí,
   * imutável. Não confundir com o id do agregado (`UploadId`).
   */
  storageUploadId: string | null;
  status: UploadStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raiz do agregado Upload — modela a SESSÃO de multipart upload, não o arquivo
 * final. Guarda a identidade do objeto no storage (`storageKey` +
 * `storageUploadId`) e o estado do processo, protegendo a transição
 * `pending → completed` (uma única vez).
 *
 * Referencia dono e pasta só por id (contextos `users`/`folders` desacoplados).
 * O agregado NÃO fala com o S3 — quem o faz é o caso de uso, via porta.
 */
export class Upload extends AggregateRoot<UploadId> {
  private constructor(id: UploadId, private props: UploadProps) {
    super(id);
  }

  /**
   * Abre uma nova sessão de upload (estado `pending`). Deriva a chave de
   * armazenamento a partir da própria identidade; o `storageUploadId` ainda não
   * existe — é anexado após criar a sessão no storage (`attachStorageUpload`).
   */
  static open(props: {
    ownerId: string;
    folderId: string;
    fileName: string;
    contentType: string;
    size: number;
  }): Upload {
    const id = UploadId.create();
    const now = new Date();
    const fileName = FileName.create(props.fileName);
    return new Upload(id, {
      ownerId: OwnerId.restore(props.ownerId),
      folderId: FolderId.restore(props.folderId),
      fileName,
      contentType: ContentType.create(props.contentType),
      size: FileSize.create(props.size),
      storageKey: StorageKey.build({
        ownerId: OwnerId.restore(props.ownerId).value,
        uploadId: id.value,
        fileName,
      }),
      storageUploadId: null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Reconstrói um upload existente a partir da persistência. */
  static restore(props: {
    id: string;
    ownerId: string;
    folderId: string;
    fileName: string;
    contentType: string;
    size: number;
    storageKey: string;
    storageUploadId: string | null;
    status: UploadStatus;
    createdAt: Date;
    updatedAt: Date;
  }): Upload {
    return new Upload(UploadId.restore(props.id), {
      ownerId: OwnerId.restore(props.ownerId),
      folderId: FolderId.restore(props.folderId),
      fileName: FileName.create(props.fileName),
      contentType: ContentType.create(props.contentType),
      size: FileSize.create(props.size),
      storageKey: StorageKey.restore(props.storageKey),
      storageUploadId: props.storageUploadId,
      status: props.status,
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

  get fileName(): FileName {
    return this.props.fileName;
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

  get storageUploadId(): string | null {
    return this.props.storageUploadId;
  }

  get status(): UploadStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** `true` enquanto a sessão está aberta e aceita partes. */
  get isPending(): boolean {
    return this.props.status === "pending";
  }

  /** Verdadeiro se o upload pertence ao usuário informado. */
  belongsTo(ownerId: string): boolean {
    return this.props.ownerId.value === OwnerId.restore(ownerId).value;
  }

  /**
   * Vincula o id de multipart do storage à sessão. Só pode ocorrer uma vez,
   * logo após criar a sessão no S3.
   */
  attachStorageUpload(storageUploadId: string): void {
    this.ensurePending();
    if (this.props.storageUploadId !== null) {
      return;
    }
    this.props.storageUploadId = storageUploadId;
    this.props.updatedAt = new Date();
  }

  /** Conclui a sessão (o storage já uniu as partes no objeto final). */
  complete(): void {
    this.ensurePending();
    this.props.status = "completed";
    this.props.updatedAt = new Date();
  }

  private ensurePending(): void {
    if (!this.isPending) {
      throw new UploadNotPendingError(this.id.value, this.props.status);
    }
  }
}
