import type { FastifyReply, FastifyRequest } from "fastify";

import type { TokenVerifier } from "../../application/ports/providers/token-verifier";
import { UnauthenticatedError } from "../../domain/errors/unauthenticated.error";

/** Identidade autenticada, extraída do token e anexada à requisição. */
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

// Disponibiliza `request.authUser` a jusante (controllers das rotas protegidas),
// preenchido por este middleware após verificar o token.
declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}

const BEARER_PREFIX = "Bearer ";

/**
 * Middleware de autenticação (contexto `users`).
 *
 * Lê o `Authorization: Bearer <token>`, verifica o JWT pela porta
 * `TokenVerifier` e anexa a identidade em `request.authUser`. Falha vira
 * `UnauthenticatedError` (401), tratada pelo error handler global.
 *
 * NÃO decide QUAIS rotas protege — isso é montado no `main` (composition root),
 * aplicando-o como `preHandler` nos escopos desejados (ex.: rotas de `files`).
 */
export class AuthenticateMiddleware {
  constructor(private readonly verifier: TokenVerifier) {}

  // Arrow para preservar o `this` ao ser passado como hook do Fastify.
  handle = async (
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> => {
    const header = request.headers.authorization;
    if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
      throw new UnauthenticatedError("Cabeçalho Authorization ausente.");
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    const payload = await this.verifier.verify(token);

    request.authUser = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
    };
  };
}
