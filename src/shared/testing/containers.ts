import { execFileSync } from "node:child_process";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, Wait } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";

const FLOCI_PORT = 4566;

export interface StartedPostgres {
  container: StartedPostgreSqlContainer;
  url: string;
}

/**
 * Starts an ephemeral Postgres and applies the project's migrations to it via
 * `prisma migrate deploy` (forward-only, the same command used in prod/CI).
 *
 * Sets `process.env.DATABASE_URL` so the Prisma client singleton — read on first
 * import — connects to this container; import the client only afterwards.
 */
export async function startPostgres(): Promise<StartedPostgres> {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: process.env,
    stdio: "pipe",
  });
  return { container, url };
}

export interface StartedFloci {
  container: StartedTestContainer;
  endpoint: string;
}

/** Starts an ephemeral floci (S3-compatible AWS simulator) container. */
export async function startFloci(): Promise<StartedFloci> {
  const container = await new GenericContainer("floci/floci:latest")
    .withExposedPorts(FLOCI_PORT)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();
  const endpoint = `http://${container.getHost()}:${container.getMappedPort(
    FLOCI_PORT,
  )}`;
  return { container, endpoint };
}
