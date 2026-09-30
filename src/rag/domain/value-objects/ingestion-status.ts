import { InvalidIngestionStatusError } from "../errors/invalid-ingestion-status.error";

/** Estados possíveis da ingestão de um documento. */
export type IngestionStatusValue =
  | "pending" // recém-enfileirado, aguardando o worker
  | "extracting" // reivindicado por um worker, extração em andamento
  | "extracted" // conteúdo extraído e persistido
  | "duplicate" // mesmo conteúdo (hash) de um documento já extraído
  | "failed"; // extração falhou (ver `error`)

/**
 * Transições legais da máquina de estados da ingestão. Um documento nasce
 * `pending`; o worker o reivindica (`extracting`) e conclui em um estado
 * terminal. `failed` pode ser reenfileirado (`pending`) para uma nova tentativa.
 */
const TRANSITIONS: Record<IngestionStatusValue, readonly IngestionStatusValue[]> =
  {
    pending: ["extracting"],
    extracting: ["extracted", "duplicate", "failed"],
    extracted: [],
    duplicate: [],
    failed: ["pending"],
  };

/**
 * Value Object do status de ingestão. Encapsula os valores válidos e as
 * transições permitidas — a regra de "o que pode virar o quê" mora aqui, não
 * espalhada pelos casos de uso.
 */
export class IngestionStatus {
  private constructor(public readonly value: IngestionStatusValue) {}

  static create(value: IngestionStatusValue): IngestionStatus {
    return new IngestionStatus(value);
  }

  static pending(): IngestionStatus {
    return new IngestionStatus("pending");
  }

  /** Muda para `next`, validando a transição; lança se for ilegal. */
  transitionTo(next: IngestionStatusValue): IngestionStatus {
    if (!TRANSITIONS[this.value].includes(next)) {
      throw new InvalidIngestionStatusError(this.value, next);
    }
    return new IngestionStatus(next);
  }

  get isTerminal(): boolean {
    return TRANSITIONS[this.value].length === 0;
  }

  equals(other: IngestionStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
