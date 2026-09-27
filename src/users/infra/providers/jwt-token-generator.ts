import { createHmac } from "node:crypto";

import type {
  TokenGenerator,
  TokenPayload,
} from "../../application/ports/providers/token-generator";

export interface JwtTokenGeneratorOptions {
  secret: string;
  expiresInSeconds: number;
  issuer?: string;
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Gerador de JWT (HS256) usando apenas `node:crypto` — sem dependências
 * externas, consistente com o hashing do domínio. Assina no formato padrão
 * `header.payload.signature` e adiciona as claims temporais (`iat`/`exp`).
 */
export class JwtTokenGenerator implements TokenGenerator {
  constructor(private readonly options: JwtTokenGeneratorOptions) {}

  async generate(payload: TokenPayload): Promise<string> {
    const header = { alg: "HS256", typ: "JWT" };
    const issuedAt = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = {
      ...payload,
      iat: issuedAt,
      exp: issuedAt + this.options.expiresInSeconds,
    };
    if (this.options.issuer !== undefined) {
      claims["iss"] = this.options.issuer;
    }

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(claims));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac("sha256", this.options.secret)
      .update(signingInput)
      .digest("base64url");

    return `${signingInput}.${signature}`;
  }
}
