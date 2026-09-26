import type { DomainEvent } from "../events/domain-event.js";

/**
 * Contrato mínimo de uma identidade de agregado: sabe comparar-se por valor.
 * Nossos ids são Value Objects (ex.: `UserId`), que satisfazem isto.
 */
export interface AggregateId {
  equals(other: this): boolean;
  toString(): string;
}

/**
 * Classe base de toda raiz de agregado.
 *
 * Fornece o que todo agregado compartilha, independentemente do contexto:
 *  - **Identidade** tipada e imutável;
 *  - **Igualdade por identidade** (dois agregados são "o mesmo" se têm o mesmo
 *    id, ainda que atributos difiram);
 *  - um **buffer de domain events** — a marca registrada de uma raiz de
 *    agregado: ela registra os fatos de negócio e a borda os drena e publica
 *    após persistir.
 *
 * Genérica sobre o tipo do id para preservar a tipagem forte de cada contexto.
 */
export abstract class AggregateRoot<TId extends AggregateId> {
  private readonly _id: TId;
  private _domainEvents: DomainEvent[] = [];

  protected constructor(id: TId) {
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  equals(other?: AggregateRoot<TId>): boolean {
    if (other === undefined || other === null) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this._id.equals(other._id);
  }

  /** Eventos ainda não publicados (somente leitura). */
  get domainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }

  /** Registra um evento de domínio ocorrido no agregado. */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /** Retorna os eventos acumulados e esvazia o buffer (chamado pela borda). */
  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }
}
