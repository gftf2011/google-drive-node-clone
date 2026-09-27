import type { User } from "../../domain/aggregates/user";
import type { UserRepository } from "../../domain/repositories/user-repository";

/**
 * Implementação em memória do `UserRepository`. Útil para desenvolvimento e
 * testes; substituível pela implementação Prisma sem tocar em domínio/aplicação.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async existsByEmail(email: string): Promise<boolean> {
    for (const user of this.users.values()) {
      if (user.email.value === email) {
        return true;
      }
    }
    return false;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.value === email) {
        return user;
      }
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id.value, user);
  }
}
