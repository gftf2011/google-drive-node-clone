import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import type {
  GetFileDownloadUrlController,
  GetFileDownloadUrlParams,
} from "../controllers/get-file-download-url.controller";

export interface FileControllers {
  getDownloadUrl: GetFileDownloadUrlController;
}

const fileIdParamsSchema = {
  type: "object",
  required: ["fileId"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string" },
  },
} as const;

/**
 * Plugin de rotas de arquivos (contexto `files`). Recebe os controllers já
 * instanciados (o composition root injeta) e os liga às rotas HTTP.
 *
 * `GET /files/:fileId/download-url` → devolve `{ url, fileName, contentType,
 * expiresInSeconds }`; o cliente baixa direto do storage pela `url`.
 */
export function fileRoutes(controllers: FileControllers): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get<{ Params: GetFileDownloadUrlParams }>(
      "/files/:fileId/download-url",
      { schema: { params: fileIdParamsSchema } },
      (request, reply) => controllers.getDownloadUrl.handle(request, reply),
    );
  };
}
