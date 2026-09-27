/**
 * Configuração da aplicação, lida e validada a partir de variáveis de ambiente.
 * Centraliza o acesso ao `process.env` — o resto do código recebe `Env` tipado.
 */
export interface Env {
  nodeEnv: string;
  host: string;
  port: number;
  jwt: {
    secret: string;
    expiresInSeconds: number;
  };
}

const DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-please";

export function loadEnv(): Env {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  const jwtSecret = process.env.JWT_SECRET;
  if (isProduction && (jwtSecret === undefined || jwtSecret.length < 32)) {
    throw new Error(
      "JWT_SECRET é obrigatório em produção (mínimo de 32 caracteres).",
    );
  }

  return {
    nodeEnv,
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3333),
    jwt: {
      secret: jwtSecret ?? DEV_JWT_SECRET,
      expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 3600),
    },
  };
}
