import { AggregateRoot } from "../../../shared/domain/aggregates/aggregate-root";
import { ContentHash } from "../value-objects/content-hash";
import { DocumentId } from "../value-objects/document-id";
import {
  IngestionStatus,
  type IngestionStatusValue,
} from "../value-objects/ingestion-status";

interface RagDocumentProps {
  ownerId: string;
  folderId: string;
  storageKey: string;
  contentType: string;
  fileName: string;
  status: IngestionStatus;
  error: string | null;
  contentHash: ContentHash | null;
  /** Nº de elementos/segmentos extraídos (métrica de ingestão; vira chunks no RAG). */
  chunkCount: number;
  /** Quando a extração concluiu (nulo enquanto pendente/extraindo). */
  indexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raiz do agregado RagDocument — o ESTADO da ingestão de um arquivo do Drive.
 *
 * Nasce (`pending`) quando um arquivo é criado; um worker o reivindica
 * (`extracting`), extrai o conteúdo com a ferramenta certa para o formato e o
 * conclui em um estado terminal: `extracted` (conteúdo persistido), `duplicate`
 * (mesmo `contentHash` de outro já extraído — sem reprocessar) ou `failed`.
 *
 * A tabela `rag_documents` é, ao mesmo tempo, o registro de estado e a FILA do
 * worker (linhas `pending`). Referencia dono/pasta/arquivo apenas por id — o
 * `rag` não conhece os agregados do `drive`.
 *
 * Segue a convenção do projeto: sem helper `touch()`; cada mutador atualiza
 * `updatedAt` inline.
 */
export class RagDocument extends AggregateRoot<DocumentId> {
  private constructor(id: DocumentId, private props: RagDocumentProps) {
    super(id);
  }

  /**
   * Enfileira a ingestão de um arquivo recém-criado (estado `pending`). Quando o
   * cliente informou o `contentHash` no upload, a linha já nasce com a chave de
   * dedup — o worker deduplica sem precisar baixar e reler os bytes.
   */
  static enqueue(props: {
    fileId: string;
    ownerId: string;
    folderId: string;
    storageKey: string;
    contentType: string;
    fileName: string;
    contentHash?: string;
  }): RagDocument {
    const now = new Date();
    return new RagDocument(DocumentId.restore(props.fileId), {
      ownerId: props.ownerId,
      folderId: props.folderId,
      storageKey: props.storageKey,
      contentType: props.contentType,
      fileName: props.fileName,
      status: IngestionStatus.pending(),
      error: null,
      contentHash:
        props.contentHash === undefined
          ? null
          : ContentHash.create(props.contentHash),
      chunkCount: 0,
      indexedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Reconstrói um documento existente a partir da persistência. */
  static restore(props: {
    fileId: string;
    ownerId: string;
    folderId: string;
    storageKey: string;
    contentType: string;
    fileName: string;
    status: IngestionStatusValue;
    error: string | null;
    contentHash: string | null;
    chunkCount: number;
    indexedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): RagDocument {
    return new RagDocument(DocumentId.restore(props.fileId), {
      ownerId: props.ownerId,
      folderId: props.folderId,
      storageKey: props.storageKey,
      contentType: props.contentType,
      fileName: props.fileName,
      status: IngestionStatus.create(props.status),
      error: props.error,
      contentHash:
        props.contentHash === null ? null : ContentHash.create(props.contentHash),
      chunkCount: props.chunkCount,
      indexedAt: props.indexedAt,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /** Reivindicado por um worker: `pending` → `extracting`. */
  startExtraction(): void {
    this.props.status = this.props.status.transitionTo("extracting");
    this.props.updatedAt = new Date();
  }

  /** Extração concluída: guarda o hash, a contagem e o momento. */
  markExtracted(contentHash: string, chunkCount: number): void {
    this.props.status = this.props.status.transitionTo("extracted");
    this.props.contentHash = ContentHash.create(contentHash);
    this.props.chunkCount = chunkCount;
    this.props.error = null;
    this.props.indexedAt = new Date();
    this.props.updatedAt = this.props.indexedAt;
  }

  /** Conteúdo idêntico a um já extraído: reaproveita, sem reprocessar. */
  markDuplicate(contentHash: string): void {
    this.props.status = this.props.status.transitionTo("duplicate");
    this.props.contentHash = ContentHash.create(contentHash);
    this.props.error = null;
    this.props.indexedAt = new Date();
    this.props.updatedAt = this.props.indexedAt;
  }

  /** Extração falhou: registra o motivo para inspeção/retentativa. */
  markFailed(message: string): void {
    this.props.status = this.props.status.transitionTo("failed");
    this.props.error = message;
    this.props.updatedAt = new Date();
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get folderId(): string {
    return this.props.folderId;
  }

  get storageKey(): string {
    return this.props.storageKey;
  }

  get contentType(): string {
    return this.props.contentType;
  }

  get fileName(): string {
    return this.props.fileName;
  }

  get status(): IngestionStatus {
    return this.props.status;
  }

  get error(): string | null {
    return this.props.error;
  }

  get contentHash(): ContentHash | null {
    return this.props.contentHash;
  }

  get chunkCount(): number {
    return this.props.chunkCount;
  }

  get indexedAt(): Date | null {
    return this.props.indexedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
