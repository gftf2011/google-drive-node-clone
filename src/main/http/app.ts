import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

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
  await app.register(userRoutes(container.userControllers));

  return app;
}
