import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * O upload faria o usuário ultrapassar sua cota de armazenamento. Falha de
 * negócio (não de transporte): a borda traduz para 507 (Insufficient Storage).
 */
export class StorageQuotaExceededError extends DomainError {
  readonly code = "STORAGE_QUOTA_EXCEEDED";

  constructor(limitBytes: number, usedBytes: number, requestedBytes: number) {
    super(
      `Cota de armazenamento excedida: limite de ${limitBytes} bytes, ` +
        `${usedBytes} em uso, +${requestedBytes} solicitados.`,
    );
  }
}
