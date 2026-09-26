import type { DomainEvent } from "../../../shared/domain/events/domain-event.js";
import type { UserId } from "../value-objects/user-id.js";

/**
 * Fato de domínio: um usuário foi criado.
 *
 * É um evento (passado), não um comando. Outros contextos reagem a ele — em
 * particular, o contexto de pastas cria o diretório raiz do usuário ao observar
 * este evento. O domínio `users` não conhece esse efeito; apenas anuncia o fato.
 */
export class UserCreated implements DomainEvent {
  static readonly EVENT_NAME = "users.user-created";

  readonly eventName = UserCreated.EVENT_NAME;
  readonly occurredAt: Date;
  readonly aggregateId: string;

  constructor(userId: UserId, occurredAt: Date) {
    this.aggregateId = userId.value;
    this.occurredAt = occurredAt;
  }
}
