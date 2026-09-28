import type { FastifyReply, FastifyRequest } from "fastify";

import type { UseCase } from "../../../shared/application/use-case";
import { UnauthenticatedError } from "../../../users/domain/errors/unauthenticated.error";
import type { DeleteFolderInput } from "../../application/use-cases/delete-folder.use-case";

export interface DeleteFolderParams {
  folderId: string;
}

/**
 * Controller HTTP da remoção de pasta. `folderId` vem da rota; `ownerId` do
 * token. Devolve 204 (sem corpo). A cascata (subpastas + arquivos + objetos)
 * é responsabilidade do caso de uso.
 */
export class DeleteFolderController {
  constructor(private readonly deleteFolder: UseCase<DeleteFolderInput, void>) {}

  async handle(
    request: FastifyRequest<{ Params: DeleteFolderParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.authUser === undefined) {
      throw new UnauthenticatedError();
    }
    await this.deleteFolder.execute({
      folderId: request.params.folderId,
      ownerId: request.authUser.id,
    });
    await reply.status(204).send();
  }
}
