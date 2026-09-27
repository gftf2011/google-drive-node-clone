import type { DomainEvent } from "../domain/events/domain-event";

/**
 * Contrato de um manipulador de evento de domínio.
 *
 * Um handler reage a um fato ocorrido em um agregado (possivelmente de outro
 * contexto) executando um caso de uso. É invocado pelo despachante de eventos.
 */
export interface EventHandler<E extends DomainEvent = DomainEvent> {
  handle(event: E): Promise<void>;
}
