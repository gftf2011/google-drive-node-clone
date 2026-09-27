/**
 * Port de saída para uma Unit of Work.
 *
 * Executa um bloco de trabalho dentro de uma transação atômica: se `work`
 * concluir sem erro, faz commit; se lançar, faz rollback e propaga o erro. A
 * implementação concreta (ex.: Prisma) define como a transação é aberta e como
 * os repositórios participam dela.
 */
export interface UnitOfWork {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
