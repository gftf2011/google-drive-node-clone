import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import type {
  CreateFolderBody,
  CreateFolderController,
} from "../controllers/create-folder.controller";
import type {
  DeleteFolderController,
  DeleteFolderParams,
} from "../controllers/delete-folder.controller";
import type {
  ListFolderContentsParams,
  ListFolderContentsController,
  ListFolderContentsQuery,
} from "../controllers/list-folder-contents.controller";

export interface FolderControllers {
  create: CreateFolderController;
  delete: DeleteFolderController;
  listContents: ListFolderContentsController;
}

// Validação de FORMATO (shape) na borda — o nome válido e as regras de negócio
// (pai existe/é do dono) ficam no domínio e no caso de uso.
const createFolderBodySchema = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    // Opcional: se ausente, a subpasta é criada na raiz do usuário.
    parentId: { type: "string" },
  },
} as const;

const folderIdParamsSchema = {
  type: "object",
  required: ["folderId"],
  additionalProperties: false,
  properties: {
    folderId: { type: "string" },
  },
} as const;

const listContentsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sort: { type: "string", enum: ["recent", "name"] },
  },
} as const;

/**
 * Plugin de rotas do contexto `folders`. Recebe os controllers já instanciados
 * (o composition root injeta) e os liga às rotas HTTP.
 */
export function folderRoutes(
  controllers: FolderControllers,
): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: CreateFolderBody }>(
      "/folders",
      { schema: { body: createFolderBodySchema } },
      (request, reply) => controllers.create.handle(request, reply),
    );

    // Conteúdo da raiz do usuário.
    app.get<{
      Params: ListFolderContentsParams;
      Querystring: ListFolderContentsQuery;
    }>(
      "/folders",
      { schema: { querystring: listContentsQuerySchema } },
      (request, reply) => controllers.listContents.handle(request, reply),
    );

    // Conteúdo de uma pasta específica.
    app.get<{
      Params: ListFolderContentsParams;
      Querystring: ListFolderContentsQuery;
    }>(
      "/folders/:folderId",
      {
        schema: {
          params: folderIdParamsSchema,
          querystring: listContentsQuerySchema,
        },
      },
      (request, reply) => controllers.listContents.handle(request, reply),
    );

    app.delete<{ Params: DeleteFolderParams }>(
      "/folders/:folderId",
      { schema: { params: folderIdParamsSchema } },
      (request, reply) => controllers.delete.handle(request, reply),
    );
  };
}
