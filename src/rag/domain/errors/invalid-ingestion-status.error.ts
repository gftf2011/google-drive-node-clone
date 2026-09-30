import { DomainError } from "../../../shared/domain/errors/domain-error";

export class InvalidIngestionStatusError extends DomainError {
  readonly code = "INVALID_INGESTION_STATUS";

  constructor(from: string, to: string) {
    super(`Transição de status de ingestão inválida: "${from}" → "${to}".`);
  }
}
