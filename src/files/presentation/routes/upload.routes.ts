import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import type {
  CompleteMultipartUploadBody,
  CompleteMultipartUploadController,
  CompleteMultipartUploadParams,
} from "../controllers/complete-multipart-upload.controller";
import type {
  StartMultipartUploadBody,
  StartMultipartUploadController,
} from "../controllers/start-multipart-upload.controller";

export interface UploadControllers {
  start: StartMultipartUploadController;
  complete: CompleteMultipartUploadController;
}

// Validação de FORMATO (shape) na borda — a validação de negócio (id válido,
// tamanho/limites, MIME) é do domínio (Value Objects).
const startBodySchema = {
  type: "object",
  required: ["folderId", "fileName", "contentType", "size"],
  additionalProperties: false,
  properties: {
    folderId: { type: "string" },
    fileName: { type: "string" },
    contentType: { type: "string" },
    size: { type: "integer", minimum: 1 },
    // Sugestão de tamanho de parte (bytes); o backend ajusta aos limites do S3.
    partSize: { type: "integer", minimum: 1 },
  },
} as const;

const uploadIdParamsSchema = {
  type: "object",
  required: ["uploadId"],
  additionalProperties: false,
  properties: {
    uploadId: { type: "string" },
  },
} as const;

const completeBodySchema = {
  type: "object",
  required: ["parts"],
  additionalProperties: false,
  properties: {
    parts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["partNumber", "etag"],
        additionalProperties: false,
        properties: {
          partNumber: { type: "integer", minimum: 1, maximum: 10000 },
          etag: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

/**
 * Plugin de rotas do contexto `files` (multipart upload). Recebe os controllers
 * já instanciados (o composition root injeta) e os liga às rotas HTTP.
 *
 * Fluxo do cliente (front-end):
 *   1. POST /uploads                    → inicia e já recebe { uploadId, partSize, parts:[{partNumber,url}] }
 *   2. Para cada parte: PUT na `url` (direto no storage) e guarda a ETag da resposta
 *   3. POST /uploads/:uploadId/complete → envia o manifesto { partNumber, etag }
 */
export function uploadRoutes(
  controllers: UploadControllers,
): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: StartMultipartUploadBody }>(
      "/uploads",
      { schema: { body: startBodySchema } },
      (request, reply) => controllers.start.handle(request, reply),
    );

    app.post<{
      Params: CompleteMultipartUploadParams;
      Body: CompleteMultipartUploadBody;
    }>(
      "/uploads/:uploadId/complete",
      { schema: { params: uploadIdParamsSchema, body: completeBodySchema } },
      (request, reply) => controllers.complete.handle(request, reply),
    );
  };
}
