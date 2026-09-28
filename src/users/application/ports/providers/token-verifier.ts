import type { TokenPayload } from "./token-generator";

/**
 * Porta de saída para verificação de tokens de acesso (ex.: JWT) — a contraparte
 * do `TokenGenerator`.
 *
 * O algoritmo, o segredo/chave e a checagem de expiração vivem no ADAPTER da
 * infra. A aplicação só entrega o token e recebe de volta as claims de
 * identidade; um token inválido/expirado é sinalizado com `UnauthenticatedError`.
 */
export interface TokenVerifier {
  verify(token: string): Promise<TokenPayload>;
}
