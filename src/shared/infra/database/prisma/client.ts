import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";

import { PrismaClient } from "./generated/client";

/**
 * Conexão com o banco — detalhe de INFRAESTRUTURA.
 *
 * Vive na borda (shared/infra) e nunca é importado pelo domínio nem pela
 * aplicação: estes falam apenas com ports. A partir do Prisma 7 o client usa um
 * driver adapter (`@prisma/adapter-pg`) sobre um pool de conexões do `pg`.
 *
 * Tanto o pool quanto o client são SINGLETONS: uma única instância por processo,
 * reaproveitada em todas as requisições. Guardá-los em `globalThis` fora de
 * produção evita abrir novos pools a cada hot-reload do tsx.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("A variável de ambiente DATABASE_URL não está definida.");
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const poolConfig: PoolConfig = {
  connectionString,
  // Nº máximo de conexões simultâneas no pool.
  max: toPositiveInt(process.env.DATABASE_POOL_MAX, 10),
  // Fecha conexões ociosas após este tempo.
  idleTimeoutMillis: toPositiveInt(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS, 30_000),
  // Tempo máximo esperando uma conexão livre do pool antes de falhar.
  connectionTimeoutMillis: toPositiveInt(
    process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    10_000,
  ),
};

const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
  prisma?: PrismaClient;
};

/** Pool de conexões PostgreSQL (singleton). */
export const pool: Pool = globalForDb.pgPool ?? new Pool(poolConfig);

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

/** Client Prisma (singleton) sobre o pool acima. */
export const prisma: PrismaClient = globalForDb.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
  globalForDb.prisma = prisma;
}

/** Encerra o client e o pool — chamar no shutdown gracioso do servidor. */
export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}
