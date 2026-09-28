import type { FastifyReply, FastifyRequest } from "fastify";

import type { UseCase } from "../../../shared/application/use-case";
import { UnauthenticatedError } from "../../../users/domain/errors/unauthenticated.error";
import type {
  GetFileDownloadUrlInput,
  GetFileDownloadUrlOutput,
} from "../../application/use-cases/get-file-download-url.use-case";

export interface GetFileDownloadUrlParams {
  fileId: string;
}

/**
 * Controller HTTP que devolve a URL pré-assinada de download. `fileId` vem da
 * rota; `ownerId` do token. Nenhuma regra de negócio.
 */
export class GetFileDownloadUrlController {
  constructor(
    private readonly getDownloadUrl: UseCase<
      GetFileDownloadUrlInput,
      GetFileDownloadUrlOutput
    >,
  ) {}

  async handle(
    request: FastifyRequest<{ Params: GetFileDownloadUrlParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.authUser === undefined) {
      throw new UnauthenticatedError();
    }
    const output = await this.getDownloadUrl.execute({
      fileId: request.params.fileId,
      ownerId: request.authUser.id,
    });
    await reply.status(200).send(output);
  }
}
