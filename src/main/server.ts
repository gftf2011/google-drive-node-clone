import "dotenv/config";

import { loadEnv } from "./config/env";
import { buildApp } from "./http/app";

/** Ponto de entrada: carrega a configuração, monta o app e sobe o servidor. */
async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp(env);

  try {
    await app.listen({ host: env.host, port: env.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void bootstrap();
