import type { EventHandler } from "../../../shared/application/event-handler.js";
import type { DomainEvent } from "../../../shared/domain/events/domain-event.js";
import type { CreateRootFolder } from "../use-cases/create-root-folder.use-case.js";

/**
 * Cria a pasta raiz de um usuário recém-criado.
 *
 * Depende apenas do contrato abstrato `DomainEvent` (kernel compartilhado) — o
 * contexto `folders` NÃO conhece o domínio de `users`. A única informação usada
 * é `event.aggregateId` (o id do dono). A ligação a um evento concreto (o
 * `UserCreated` de `users`) é feita por nome no composition root, ao registrar
 * este handler no despachante.
 */
export class CreateRootFolderOnUserCreated implements EventHandler {
  constructor(private readonly createRootFolder: CreateRootFolder) {}

  async handle(event: DomainEvent): Promise<void> {
    await this.createRootFolder.execute({ ownerId: event.aggregateId });
  }
}
