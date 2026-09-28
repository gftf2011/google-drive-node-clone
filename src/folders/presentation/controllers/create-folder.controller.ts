import type { FastifyReply, FastifyRequest } from "fastify";

import type { UseCase } from "../../../shared/application/use-case";
import { UnauthenticatedError } from "../../../users/domain/errors/unauthenticated.error";
import type {
  CreateFolderInput,
  CreateFolderOutput,
} from "../../application/use-cases/create-folder.use-case";

export interface CreateFolderBody {
  name: string;
  parentId?: string;
}

/**
 * Controller HTTP da criação de pasta. Traduz request → input e output →
 * response; nenhuma regra de negócio. O `ownerId` vem do token (não do body).
 */
export class CreateFolderController {
  constructor(
    private readonly createFolder: UseCase<
      CreateFolderInput,
      CreateFolderOutput
    >,
  ) {}

  async handle(
    request: FastifyRequest<{ Body: CreateFolderBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.authUser === undefined) {
      throw new UnauthenticatedError();
    }
    const { name, parentId } = request.body;
    const output = await this.createFolder.execute({
      ownerId: request.authUser.id,
      name,
      parentId,
    });
    await reply.status(201).send(output);
  }
}
