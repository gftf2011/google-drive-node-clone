import type { FastifyError, FastifyInstance } from "fastify";

import { DomainError } from "../../domain/errors/domain-error";

/**
 * Traduz o `code` de um erro de domínio para um status HTTP. É a tradução da
 * BORDA — o domínio não conhece HTTP. A maioria dos erros de negócio é falha do
 * cliente (400); os casos abaixo têm semântica própria.
 */
const STATUS_BY_CODE: Record<string, number> = {
  EMAIL_ALREADY_IN_USE: 409,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  UPLOAD_NOT_FOUND: 404,
  UPLOAD_NOT_OWNED: 403,
  UPLOAD_NOT_PENDING: 409,
  STORAGE_QUOTA_EXCEEDED: 507,
  FILE_NOT_FOUND: 404,
  FILE_ACCESS_DENIED: 403,
  PARENT_FOLDER_NOT_FOUND: 404,
  FOLDER_NOT_FOUND: 404,
  FOLDER_ACCESS_DENIED: 403,
};

function statusForDomainError(error: DomainError): number {
  return STATUS_BY_CODE[error.code] ?? 400;
}

/**
 * Registra o tratador de erros global: erros de domínio viram respostas HTTP
 * previsíveis; falhas de validação de schema viram 400; o resto é 500.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply
        .status(statusForDomainError(error))
        .send({ error: error.code, message: error.message });
    }

    const fastifyError = error as FastifyError;
    if (fastifyError.validation !== undefined) {
      return reply
        .status(400)
        .send({ error: "VALIDATION_ERROR", message: fastifyError.message });
    }

    request.log.error(error);
    return reply
      .status(500)
      .send({ error: "INTERNAL_ERROR", message: "Erro interno do servidor." });
  });
}
