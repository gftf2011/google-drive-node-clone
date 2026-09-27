import type { DomainEvent } from "../../domain/events/domain-event";

/**
 * Port de saída para publicação de eventos de domínio.
 *
 * A camada de aplicação drena os eventos do agregado (após salvar) e os publica
 * por aqui. A estratégia de despacho — síncrona na mesma transação ou
 * assíncrona via outbox — é decidida no ADAPTER que implementa este port, sem
 * impacto no código dos casos de uso.
 */
export interface DomainEventPublisher {
  publishAll(events: readonly DomainEvent[]): Promise<void>;
}
