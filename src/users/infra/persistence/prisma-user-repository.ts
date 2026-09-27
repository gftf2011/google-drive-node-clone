import type { PrismaTransactionContext } from "../../../shared/infra/database/prisma/prisma-transaction-context";
import { User } from "../../domain/aggregates/user";
import type { UserRepository } from "../../domain/repositories/user-repository";

/**
 * Implementação Prisma do `UserRepository`.
 *
 * Obtém o client corrente do `PrismaTransactionContext` — se um caso de uso
 * estiver dentro de uma Unit of Work, as operações rodam na transação ativa.
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly context: PrismaTransactionContext) {}

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.context.client.user.count({ where: { email } });
    return count > 0;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.context.client.user.findUnique({ where: { email } });
    if (row === null) {
      return null;
    }
    return User.restore({
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(user: User): Promise<void> {
    const data = {
      name: user.name.value,
      email: user.email.value,
      password: user.password.hash,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    await this.context.client.user.upsert({
      where: { id: user.id.value },
      create: { id: user.id.value, ...data },
      update: data,
    });
  }
}
