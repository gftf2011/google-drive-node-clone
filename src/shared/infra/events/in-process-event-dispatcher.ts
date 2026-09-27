import type { EventHandler } from "../../application/event-handler";
import type { DomainEventPublisher } from "../../application/ports/domain-event-publisher";
import type { DomainEvent } from "../../domain/events/domain-event";

/**
 * Despachante de eventos SÍNCRONO e in-process.
 *
 * Implementa o port `DomainEventPublisher`: ao publicar, invoca (e aguarda) os
 * handlers registrados para cada `eventName`, na mesma execução do caso de uso.
 * Estratégia recomendada para o MVP — consistência forte. Trocar para uma
 * versão assíncrona (outbox) é substituir este adapter, sem tocar nos use cases.
 */
export class InProcessEventDispatcher implements DomainEventPublisher {
  private readonly handlers = new Map<string, EventHandler[]>();

  /** Registra um handler para um nome de evento (feito no composition root). */
  register(eventName: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventName) ?? [];
    existing.push(handler);
    this.handlers.set(eventName, existing);
  }

  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      const handlers = this.handlers.get(event.eventName) ?? [];
      for (const handler of handlers) {
        await handler.handle(event);
      }
    }
  }
}
