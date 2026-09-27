import type { UnitOfWork } from "./ports/unit-of-work";
import type { UseCase } from "./use-case";

/**
 * Decorator que executa um caso de uso dentro de uma Unit of Work.
 *
 * Tudo o que o `execute` do caso de uso interno fizer — gravações em
 * repositórios e o despacho SÍNCRONO de eventos de domínio (ex.: criar a pasta
 * raiz ao cadastrar um usuário) — acontece na MESMA transação: commita junto ou
 * reverte junto. O caso de uso decorado não sabe que está transacionado.
 */
export class TransactionalUseCase<Input, Output>
  implements UseCase<Input, Output>
{
  constructor(
    private readonly useCase: UseCase<Input, Output>,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(input: Input): Promise<Output> {
    return this.unitOfWork.runInTransaction(() => this.useCase.execute(input));
  }
}
