import type { DomainEventPublisher } from "../../../shared/application/ports/domain-event-publisher";
import type { UseCase } from "../../../shared/application/use-case";
import { User } from "../../domain/aggregates/user";
import { EmailAlreadyInUseError } from "../../domain/errors/email-already-in-use.error";
import type { UserRepository } from "../../domain/repositories/user-repository";
import { Email } from "../../domain/value-objects/email";
import type { TokenGenerator } from "../ports/providers/token-generator";

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
export class SignUp implements UseCase<SignUpInput, SignUpOutput> {
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
