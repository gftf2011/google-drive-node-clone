import type { FastifyInstance } from "fastify";

import type { PrismaClient } from "../infra/database/prisma/generated/client";

import { startFloci, startPostgres } from "./containers";

const TEST_BUCKET = "gdrive-uploads-test";

export interface AppEnvironment {
  app: FastifyInstance;
  prisma: PrismaClient;
  storageEndpoint: string;
  bucket: string;
  stop: () => Promise<void>;
}

/**
 * Boots the full application against real infrastructure (Postgres + floci) in
 * ephemeral containers — the setup shared by the e2e specs.
 *
 * Environment variables are set BEFORE dynamically importing the app, because
 * the Prisma client and the env config are read at import time.
 */
export async function startAppEnvironment(): Promise<AppEnvironment> {
  const postgres = await startPostgres();
  const floci = await startFloci();

  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-com-mais-de-32-caracteres-para-e2e";
  process.env.JWT_EXPIRES_IN_SECONDS = "3600";
  process.env.STORAGE_REGION = "us-east-1";
  process.env.STORAGE_BUCKET = TEST_BUCKET;
  process.env.STORAGE_ENDPOINT = floci.endpoint;
  process.env.STORAGE_ACCESS_KEY_ID = "test";
  process.env.STORAGE_SECRET_ACCESS_KEY = "test";
  process.env.STORAGE_FORCE_PATH_STYLE = "true";
  process.env.STORAGE_PRESIGN_EXPIRES_IN_SECONDS = "900";

  const { loadEnv } = await import("../../main/config/env");
  const { buildApp } = await import("../../main/http/app");
  const { prisma, closeDatabase } = await import(
    "../infra/database/prisma/client"
  );

  const app = await buildApp(loadEnv());
  await app.ready();

  return {
    app,
    prisma,
    storageEndpoint: floci.endpoint,
    bucket: TEST_BUCKET,
    stop: async () => {
      await app.close();
      await closeDatabase();
      await floci.container.stop();
      await postgres.container.stop();
    },
  };
}
