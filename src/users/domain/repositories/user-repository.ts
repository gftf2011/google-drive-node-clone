import type { User } from "../aggregates/user.js";

/**
 * Contrato de persistência do agregado User — parte do DOMÍNIO.
 *
 * É o domínio que declara o que precisa para guardar/recuperar seus agregados;
 * a implementação concreta (Prisma, in-memory, etc.) vive na infra e depende
 * desta interface, nunca o contrário. A regra da dependência aponta para dentro.
 */
export interface UserRepository {
  /** Indica se já existe um usuário com o e-mail informado (já normalizado). */
  existsByEmail(email: string): Promise<boolean>;

  /** Recupera um usuário pelo e-mail (já normalizado), ou `null` se não existir. */
  findByEmail(email: string): Promise<User | null>;

  /** Persiste um usuário (novo ou já existente). */
  save(user: User): Promise<void>;
}
