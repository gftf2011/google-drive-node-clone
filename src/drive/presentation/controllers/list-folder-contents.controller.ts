import type { FastifyReply, FastifyRequest } from "fastify";

import type { ListSort } from "../../../shared/application/list-sort";
import type { UseCase } from "../../../shared/application/use-case";
import { UnauthenticatedError } from "../../../users/domain/errors/unauthenticated.error";
import type {
  ListFolderContentsInput,
  ListFolderContentsOutput,
} from "../../application/use-cases/list-folder-contents.use-case";

export interface ListFolderContentsParams {
  folderId?: string;
}

export interface ListFolderContentsQuery {
  sort?: ListSort;
}

/**
 * Controller HTTP que lista o conteúdo de uma pasta (subpastas + arquivos).
 * `folderId` vem da rota (ausente = raiz); `ownerId` do token; `sort` da query
 * (padrão: mais recentes primeiro). Nenhuma regra de negócio.
 */
export class ListFolderContentsController {
  constructor(
    private readonly listContents: UseCase<
      ListFolderContentsInput,
      ListFolderContentsOutput
    >,
  ) {}

  async handle(
    request: FastifyRequest<{
      Params: ListFolderContentsParams;
      Querystring: ListFolderContentsQuery;
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.authUser === undefined) {
      throw new UnauthenticatedError();
    }
    const sort: ListSort = request.query.sort ?? "recent";
    const output = await this.listContents.execute({
      ownerId: request.authUser.id,
      folderId: request.params.folderId,
      sort,
    });
    await reply.status(200).send({ sort, ...output });
  }
}
