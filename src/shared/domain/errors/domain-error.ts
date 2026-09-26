/**
 * Base de todos os erros de negócio.
 *
 * Falhas de domínio são tipos — não strings soltas nem códigos HTTP. Isso mantém
 * o domínio independente do transporte: a borda (HTTP, fila, CLI) decide como
 * traduzir cada `code` para o mundo externo.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
