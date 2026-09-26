/**
 * Claims de identidade que viajam no token. É o que o domínio conhece sobre o
 * usuário; expiração (`exp`), emissão (`iat`) e assinatura são responsabilidade
 * do adapter que implementa o port.
 */
export interface TokenPayload {
  /** Identidade do usuário (subject). */
  sub: string;
  name: string;
  email: string;
}

/**
 * Port de saída para geração de tokens de acesso (ex.: JWT).
 *
 * O algoritmo, o segredo/chave e o tempo de expiração vivem no ADAPTER da infra.
 * A aplicação só fornece as claims e recebe o token assinado.
 */
export interface TokenGenerator {
  generate(payload: TokenPayload): Promise<string>;
}
