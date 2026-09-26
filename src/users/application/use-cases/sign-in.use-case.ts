import { InvalidCredentialsError } from "../../domain/errors/invalid-credentials.error.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
import { Email } from "../../domain/value-objects/email.js";
import type { TokenGenerator } from "../ports/providers/token-generator.js";

export interface SignInInput {
  email: string;
  /** Senha em texto puro, verificada contra o hash armazenado. */
  password: string;
}

export interface SignInOutput {
  /** Token de acesso (JWT) já com as informações do usuário nas claims. */
  token: string;
}

/**
 * Caso de uso: autenticação (sign-in) de um usuário existente.
 *
 * Orquestra o domínio e conversa com o mundo externo apenas por ports. Não
 * revela se o e-mail existe: usuário inexistente e senha incorreta produzem o
 * mesmo erro.
 */
export class SignIn {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenGenerator,
  ) {}

  async execute(input: SignInInput): Promise<SignInOutput> {
    // Normaliza o e-mail para casar com o valor persistido (lowercase/trim).
    const email = Email.create(input.email);
    const user = await this.users.findByEmail(email.value);

    // Mesma falha para usuário inexistente e senha errada (anti-enumeração).
    if (user === null || !user.password.matches(input.password)) {
      throw new InvalidCredentialsError();
    }

    const token = await this.tokens.generate({
      sub: user.id.value,
      name: user.name.value,
      email: user.email.value,
    });

    return { token };
  }
}
