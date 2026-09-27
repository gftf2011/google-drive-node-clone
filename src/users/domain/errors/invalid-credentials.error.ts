import { DomainError } from "../../../shared/domain/errors/domain-error";

/**
 * Falha de autenticação. Usada tanto para usuário inexistente quanto para senha
 * incorreta — a mensagem é intencionalmente genérica para não revelar se um
 * e-mail está cadastrado (evita enumeração de usuários).
 */
export class InvalidCredentialsError extends DomainError {
  readonly code = "INVALID_CREDENTIALS";

  constructor() {
    super("E-mail ou senha inválidos.");
  }
}
