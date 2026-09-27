import { AsyncLocalStorage } from "node:async_hooks";

import type { UnitOfWork } from "../../../application/ports/unit-of-work";

import type { Prisma, PrismaClient } from "./generated/client";

/** Client utilizável por um repositório: o root ou um client transacional. */
export type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

/**
 * Contexto de transação do Prisma.
 *
 * Implementa a `UnitOfWork` e, ao mesmo tempo, expõe o client "corrente" para os
 * repositórios. Usa `AsyncLocalStorage` para propagar o client transacional pela
 * cadeia de chamadas: dentro de `runInTransaction`, `client` devolve o `tx`;
 * fora, devolve o client root. Assim os repositórios participam da transação sem
 * receber o `tx` por parâmetro (assinaturas dos ports permanecem limpas).
 */
export class PrismaTransactionContext implements UnitOfWork {
  private readonly storage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly root: PrismaClient) {}

  /** Client a ser usado agora: o transacional, se houver, senão o root. */
  get client(): PrismaClientLike {
    return this.storage.getStore() ?? this.root;
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    // Já dentro de uma transação: junta-se a ela (não aninha uma nova).
    if (this.storage.getStore() !== undefined) {
      return work();
    }
    return this.root.$transaction((tx) => this.storage.run(tx, work));
  }
}
