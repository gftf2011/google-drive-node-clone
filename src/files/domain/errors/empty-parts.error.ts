import { DomainError } from "../../../shared/domain/errors/domain-error";

/** Não é possível concluir um multipart upload sem ao menos uma parte. */
export class EmptyPartsError extends DomainError {
  readonly code = "EMPTY_PARTS";

  constructor() {
    super("A conclusão do upload exige ao menos uma parte enviada.");
  }
}
