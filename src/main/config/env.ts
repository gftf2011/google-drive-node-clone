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
  storage: {
    region: string;
    bucket: string;
    /** Endpoint do S3. Em dev, o simulador `floci` (http://localhost:4566). */
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    /** Path-style é obrigatório com o `floci`/LocalStack. */
    forcePathStyle: boolean;
    /** Validade das URLs pré-assinadas de parte, em segundos. */
    presignExpiresInSeconds: number;
    /** Cota total de armazenamento por usuário, em bytes. */
    userQuotaBytes: number;
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

  // Endpoint ausente em produção = S3 real (SDK resolve pela região). Em dev,
  // aponta para o `floci`. `undefined` (não string vazia) para o SDK ignorá-lo.
  const storageEndpoint = process.env.STORAGE_ENDPOINT;

  return {
    nodeEnv,
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3333),
    jwt: {
      secret: jwtSecret ?? DEV_JWT_SECRET,
      expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 3600),
    },
    storage: {
      region: process.env.STORAGE_REGION ?? "us-east-1",
      bucket: process.env.STORAGE_BUCKET ?? "gdrive-uploads",
      endpoint:
        storageEndpoint !== undefined && storageEndpoint.length > 0
          ? storageEndpoint
          : undefined,
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "test",
      forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
      presignExpiresInSeconds: Number(
        process.env.STORAGE_PRESIGN_EXPIRES_IN_SECONDS ?? 900,
      ),
      // Default: 15 GiB por usuário.
      userQuotaBytes: Number(
        process.env.STORAGE_USER_QUOTA_BYTES ?? 15 * 1024 ** 3,
      ),
    },
  };
}
