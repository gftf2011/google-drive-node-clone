import type { FastifyReply, FastifyRequest } from "fastify";

import type { UseCase } from "../../../shared/application/use-case";
import { UnauthenticatedError } from "../../../users/domain/errors/unauthenticated.error";
import type {
  StartMultipartUploadInput,
  StartMultipartUploadOutput,
} from "../../application/use-cases/start-multipart-upload.use-case";

export interface StartMultipartUploadBody {
  folderId: string;
  fileName: string;
  contentType: string;
  size: number;
  partSize?: number;
}

/**
 * Controller HTTP que inicia um multipart upload. Traduz request → input e
 * output → response; nenhuma regra de negócio. Devolve 201 com o `uploadId` que
 * o cliente usará para assinar as partes e concluir.
 */
export class StartMultipartUploadController {
  constructor(
    private readonly startUpload: UseCase<
      StartMultipartUploadInput,
      StartMultipartUploadOutput
    >,
  ) {}

  async handle(
    request: FastifyRequest<{ Body: StartMultipartUploadBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.authUser === undefined) {
      throw new UnauthenticatedError();
    }
    const { folderId, fileName, contentType, size, partSize } = request.body;
    const output = await this.startUpload.execute({
      ownerId: request.authUser.id,
      folderId,
      fileName,
      contentType,
      size,
      partSize,
    });
    await reply.status(201).send(output);
  }
}
