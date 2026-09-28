/** Uma parte já enviada, identificada por número e pela ETag devolvida pelo storage. */
export interface UploadedPart {
  partNumber: number;
  /** ETag que o storage retornou ao receber a parte (via header `ETag`). */
  etag: string;
}

export interface CreateMultipartUploadInput {
  key: string;
  contentType: string;
}

export interface PresignUploadPartInput {
  key: string;
  /** Id do multipart upload no storage. */
  storageUploadId: string;
  partNumber: number;
  /** Validade da URL assinada, em segundos. */
  expiresInSeconds: number;
}

export interface CompleteMultipartUploadInput {
  key: string;
  storageUploadId: string;
  parts: UploadedPart[];
}

export interface CompletedObject {
  /** ETag do objeto final montado. */
  etag: string;
  /** Localização (URL) do objeto no storage, quando fornecida. */
  location: string;
}

/**
 * Porta de saída para armazenamento de objetos compatível com S3.
 *
 * Abstrai o multipart upload por trás de quatro operações. A aplicação NÃO
 * conhece a AWS: o SDK, as credenciais, o endpoint (S3 real ou o simulador
 * `floci` em dev) e a assinatura das URLs vivem no ADAPTER da infra.
 *
 * O envio dos bytes de cada parte NÃO passa por aqui: o cliente faz `PUT`
 * direto no storage usando a URL assinada devolvida por `presignUploadPart`.
 */
export interface ObjectStorage {
  /** Inicia uma sessão de multipart e devolve o id do upload no storage. */
  createMultipartUpload(input: CreateMultipartUploadInput): Promise<string>;

  /** Gera uma URL assinada para o cliente enviar (`PUT`) uma parte. */
  presignUploadPart(input: PresignUploadPartInput): Promise<string>;

  /** Une as partes no objeto final e encerra a sessão. */
  completeMultipartUpload(
    input: CompleteMultipartUploadInput,
  ): Promise<CompletedObject>;
}
