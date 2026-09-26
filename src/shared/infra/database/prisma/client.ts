import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";

/**
 * Singleton do PrismaClient — detalhe de INFRAESTRUTURA.
 *
 * Vive na borda (shared/infra) e nunca é importado diretamente pelo domínio
 * nem pela camada de aplicação: estes falam apenas com ports (interfaces).
 * A partir do Prisma 7 o client usa um driver adapter (`@prisma/adapter-pg`).
 * Guardar o client em `globalThis` fora de produção evita esgotar o pool de
 * conexões quando o hot-reload reinstancia módulos.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("A variável de ambiente DATABASE_URL não está definida.");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
