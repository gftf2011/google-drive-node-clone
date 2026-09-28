import { createHmac, timingSafeEqual } from "node:crypto";

import type { TokenPayload } from "../../application/ports/providers/token-generator";
import type { TokenVerifier } from "../../application/ports/providers/token-verifier";
import { UnauthenticatedError } from "../../domain/errors/unauthenticated.error";

export interface JwtTokenVerifierOptions {
  secret: string;
}

/** Comparação em tempo constante de duas strings (evita timing attack). */
function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Verificador de JWT (HS256) usando apenas `node:crypto` — espelho exato do
 * `JwtTokenGenerator`. Recalcula a assinatura sobre `header.payload` e compara
 * em tempo constante; depois valida a expiração (`exp`). Qualquer falha vira
 * `UnauthenticatedError` — o adapter NÃO revela o motivo detalhado ao cliente.
 */
export class JwtTokenVerifier implements TokenVerifier {
  constructor(private readonly options: JwtTokenVerifierOptions) {}

  async verify(token: string): Promise<TokenPayload> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UnauthenticatedError("Token malformado.");
    }
    const [encodedHeader, encodedPayload, signature] = parts as [
      string,
      string,
      string,
    ];

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expected = createHmac("sha256", this.options.secret)
      .update(signingInput)
      .digest("base64url");
    if (!safeEquals(signature, expected)) {
      throw new UnauthenticatedError("Assinatura do token inválida.");
    }

    const header = this.decode(encodedHeader);
    if (header["alg"] !== "HS256") {
      throw new UnauthenticatedError("Algoritmo do token não suportado.");
    }

    const claims = this.decode(encodedPayload);
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims["exp"] === "number" && claims["exp"] < now) {
      throw new UnauthenticatedError("Token expirado.");
    }

    const { sub, name, email } = claims;
    if (
      typeof sub !== "string" ||
      typeof name !== "string" ||
      typeof email !== "string"
    ) {
      throw new UnauthenticatedError("Token sem as claims esperadas.");
    }
    return { sub, name, email };
  }

  private decode(segment: string): Record<string, unknown> {
    try {
      const json = Buffer.from(segment, "base64url").toString("utf8");
      const parsed: unknown = JSON.parse(json);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("segmento não é um objeto");
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new UnauthenticatedError("Token malformado.");
    }
  }
}
