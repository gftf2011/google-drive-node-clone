import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import { uploadRoutes } from "../../files/presentation/routes/upload.routes";
import { folderRoutes } from "../../folders/presentation/routes/folder.routes";
import { registerErrorHandler } from "../../shared/presentation/http/error-handler";
import { userRoutes } from "../../users/presentation/routes/user.routes";
import type { Env } from "../config/env";
import { buildContainer } from "../container";

/**
 * Monta a instância Fastify: logger, tratador de erros global, healthcheck e as
 * rotas de cada contexto (ligadas aos controllers pelo composition root).
 */
export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.nodeEnv === "production" ? "info" : "debug" },
  });

  registerErrorHandler(app);

  app.get("/health", async () => ({ status: "ok" }));

  const container = buildContainer(env);

  // Em dev, garante o bucket no `floci` (cria + libera CORS) antes de aceitar
  // uploads. Em produção o bucket é provisionado por infraestrutura.
  if (env.nodeEnv !== "production") {
    try {
      await container.storage.ensureBucketExists();
    } catch (error) {
      app.log.warn(
        { err: error },
        "Não foi possível preparar o bucket de uploads (o floci está no ar?).",
      );
    }
  }

  await app.register(userRoutes(container.userControllers));

  // Rotas protegidas (`files` e `folders`): num escopo próprio (encapsulamento
  // do Fastify), o `preHandler` de autenticação roda antes de cada rota e NÃO
  // vaza para as demais. O middleware é do `users`; o `main` decide onde montá-lo.
  await app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", container.authenticate.handle);
    await protectedRoutes.register(uploadRoutes(container.uploadControllers));
    await protectedRoutes.register(folderRoutes(container.folderControllers));
  });

  return app;
}
