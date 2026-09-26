/**
 * Contrato mínimo de um evento de domínio — algo relevante que aconteceu no
 * passado dentro de um agregado (ex.: `UserRegistered`).
 *
 * Agregados acumulam eventos ao mudar de estado; a borda os publica após
 * persistir com sucesso.
 */
export interface DomainEvent {
  /** Quando o fato ocorreu. */
  readonly occurredAt: Date;
  /** Identidade do agregado que originou o evento. */
  readonly aggregateId: string;
}
