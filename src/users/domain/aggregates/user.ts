import { AggregateRoot } from "../../../shared/domain/aggregates/aggregate-root";
import { UserCreated } from "../events/user-created.event";
import { Email } from "../value-objects/email";
import { Name } from "../value-objects/name";
import { Password } from "../value-objects/password";
import { UserId } from "../value-objects/user-id";

interface UserProps {
  name: Name;
  email: Email;
  password: Password;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raiz do agregado User.
 *
 * É o único ponto de entrada para alterar o estado do usuário e protege suas
 * invariantes. Não pode existir em estado inválido: os Value Objects garantem
 * a validade de cada atributo por construção, e as transições abaixo mantêm a
 * consistência ao longo do ciclo de vida. Identidade e igualdade vêm de
 * `AggregateRoot`.
 */
export class User extends AggregateRoot<UserId> {
  private constructor(id: UserId, private props: UserProps) {
    super(id);
  }

  /**
   * Cria um novo usuário (ainda não persistido) a partir de dados crus.
   * Gera id e timestamps. Os Value Objects são construídos aqui e validam a
   * entrada — `password` é a senha em TEXTO PURO, que o VO `Password` valida e
   * transforma em hash com salt.
   */
  static create(props: { name: string; email: string; password: string }): User {
    const now = new Date();
    const user = new User(UserId.create(), {
      name: Name.create(props.name),
      email: Email.create(props.email),
      password: Password.create(props.password),
      createdAt: now,
      updatedAt: now,
    });
    // Anuncia o fato. Um handler no contexto de pastas reage criando o
    // diretório raiz vinculado a este usuário.
    user.addDomainEvent(new UserCreated(user.id, now));
    return user;
  }

  /**
   * Reconstrói um usuário existente a partir da persistência (dados crus vindos
   * do banco). Revalida via os Value Objects para não reidratar estado inválido.
   */
  static restore(props: {
    id: string;
    name: string;
    email: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return new User(UserId.restore(props.id), {
      name: Name.create(props.name),
      email: Email.create(props.email),
      password: Password.fromHash(props.password),
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  get name(): Name {
    return this.props.name;
  }

  get email(): Email {
    return this.props.email;
  }

  get password(): Password {
    return this.props.password;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(name: string): void {
    const next = Name.create(name);
    if (this.props.name.equals(next)) {
      return;
    }
    this.props.name = next;
    this.props.updatedAt = new Date();
  }

  changeEmail(email: string): void {
    const next = Email.create(email);
    if (this.props.email.equals(next)) {
      return;
    }
    this.props.email = next;
    this.props.updatedAt = new Date();
  }

  /** Recebe a senha em TEXTO PURO; o VO `Password` valida e hasheia. */
  changePassword(rawPassword: string): void {
    this.props.password = Password.create(rawPassword);
    this.props.updatedAt = new Date();
  }
}
