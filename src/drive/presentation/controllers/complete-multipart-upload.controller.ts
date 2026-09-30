import type { FastifyReply, FastifyRequest } from "fastify";

import type { UseCase } from "../../../shared/application/use-case";
import { UnauthenticatedError } from "../../../users/domain/errors/unauthenticated.error";
import type {
  CompleteMultipartUploadInput,
  CompleteMultipartUploadOutput,
} from "../../application/use-cases/complete-multipart-upload.use-case";

export interface CompleteMultipartUploadParams {
  uploadId: string;
}

export interface CompleteMultipartUploadBody {
  parts: { partNumber: number; etag: string }[];
  /** SHA-256 (hex) do arquivo, calculado pelo cliente; opcional. */
  contentHash?: string;
}

/**
 * Controller HTTP que conclui um multipart upload. Recebe o manifesto das partes
 * (número + ETag) e devolve a chave, a ETag e a localização do objeto final.
 */
export class CompleteMultipartUploadController {
  constructor(
    private readonly completeUpload: UseCase<
      CompleteMultipartUploadInput,
      CompleteMultipartUploadOutput
    >,
  ) {}

  async handle(
    request: FastifyRequest<{
      Params: CompleteMultipartUploadParams;
      Body: CompleteMultipartUploadBody;
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.authUser === undefined) {
      throw new UnauthenticatedError();
    }
    const output = await this.completeUpload.execute({
      uploadId: request.params.uploadId,
      ownerId: request.authUser.id,
      parts: request.body.parts,
      contentHash: request.body.contentHash,
    });
    await reply.status(200).send(output);
  }
}
