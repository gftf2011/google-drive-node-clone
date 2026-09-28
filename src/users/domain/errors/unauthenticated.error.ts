import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * Requisição sem identidade válida: token ausente, malformado, com assinatura
 * inválida ou expirado. É falha de AUTENTICAÇÃO (401) — distinta de autorização
 * (o recurso não é seu, ex.: `UPLOAD_NOT_OWNED` → 403).
 */
export class UnauthenticatedError extends DomainError {
  readonly code = "UNAUTHENTICATED";

  constructor(message = "Autenticação necessária.") {
    super(message);
  }
}
