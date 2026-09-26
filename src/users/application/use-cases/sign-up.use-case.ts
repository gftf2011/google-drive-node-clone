import type { DomainEventPublisher } from "../../../shared/application/ports/domain-event-publisher.js";
import { User } from "../../domain/aggregates/user.js";
import { EmailAlreadyInUseError } from "../../domain/errors/email-already-in-use.error.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
import { Email } from "../../domain/value-objects/email.js";
import type { TokenGenerator } from "../ports/providers/token-generator.js";

export interface SignUpInput {
  name: string;
  email: string;
  /** Senha em texto puro; o domínio a valida e hasheia. */
  password: string;
}

export interface SignUpOutput {
  /** Token de acesso (JWT) já com as informações do usuário nas claims. */
  token: string;
}

/**
 * Caso de uso: cadastro (sign-up) de um novo usuário.
 *
 * Orquestra o domínio e conversa com o mundo externo apenas por ports. Recebe
 * suas dependências por injeção no construtor; não conhece framework, ORM nem
 * cripto.
 */
export class SignUp {
  constructor(
    private readonly users: UserRepository,
    private readonly events: DomainEventPublisher,
    private readonly tokens: TokenGenerator,
  ) {}

  async execute(input: SignUpInput): Promise<SignUpOutput> {
    // Valida/normaliza o e-mail (barato) e checa unicidade ANTES de criar o
    // usuário — o `User.create` roda o hashing (scrypt), que é caro.
    const email = Email.create(input.email);

    if (await this.users.existsByEmail(email.value)) {
      throw new EmailAlreadyInUseError(email.value);
    }

    const user = User.create({
      name: input.name,
      email: input.email,
      password: input.password,
    });

    await this.users.save(user);

    // Publica os eventos registrados pelo agregado (ex.: UserCreated, que
    // dispara a criação do diretório raiz em outro contexto).
    await this.events.publishAll(user.pullDomainEvents());

    // Usuário já sai autenticado: gera o token de acesso com suas informações.
    const token = await this.tokens.generate({
      sub: user.id.value,
      name: user.name.value,
      email: user.email.value,
    });

    return { token };
  }
}
