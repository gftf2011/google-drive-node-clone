import "dotenv/config";

import { closeDatabase } from "../shared/infra/database/prisma/client";

import { loadEnv } from "./config/env";
import { buildApp } from "./http/app";

/** Ponto de entrada: carrega a configuração, monta o app e sobe o servidor. */
async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp(env);

  // Encerra servidor e pool de conexões de forma graciosa.
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void (async () => {
        await app.close();
        await closeDatabase();
        process.exit(0);
      })();
    });
  }

  try {
    await app.listen({ host: env.host, port: env.port });
  } catch (error) {
    app.log.error(error);
    await closeDatabase();
    process.exit(1);
  }
}

void bootstrap();
