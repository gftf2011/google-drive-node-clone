import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { InvalidPasswordError } from "../errors/invalid-password.error";
import { WeakPasswordError } from "../errors/weak-password.error";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SEPARATOR = ":";
const HEX = /^[0-9a-f]+$/i;

/**
 * Senha do usuário.
 *
 * Recebe a senha em TEXTO PURO, valida sua força e a transforma em hash com um
 * salt aleatório usando scrypt (`node:crypto`, biblioteca padrão do Node — o
 * domínio segue sem dependências de frameworks externos). O valor armazenado é
 * `salt:hash` (hex), auto-contido para verificação posterior. A partir da
 * criação, o texto puro é descartado e nunca fica retido no objeto.
 */
export class Password {
  private constructor(public readonly hash: string) {}

  /** Cria a partir da senha crua: valida força, gera salt e hasheia. */
  static create(raw: string): Password {
    if (typeof raw !== "string" || raw.length < MIN_LENGTH || raw.length > MAX_LENGTH) {
      throw new WeakPasswordError(MIN_LENGTH, MAX_LENGTH);
    }
    const salt = randomBytes(SALT_BYTES);
    const derived = scryptSync(raw, salt, KEY_BYTES);
    return new Password(`${salt.toString("hex")}${SEPARATOR}${derived.toString("hex")}`);
  }

  /** Reidrata a partir do valor `salt:hash` já persistido (sem hashear). */
  static fromHash(stored: string): Password {
    if (typeof stored !== "string") {
      throw new InvalidPasswordError();
    }
    const [salt, key] = stored.split(SEPARATOR);
    if (salt === undefined || key === undefined || !HEX.test(salt) || !HEX.test(key)) {
      throw new InvalidPasswordError();
    }
    return new Password(stored);
  }

  /** Verifica, em tempo constante, se uma senha em texto puro corresponde ao hash. */
  matches(raw: string): boolean {
    const [saltHex, keyHex] = this.hash.split(SEPARATOR);
    if (saltHex === undefined || keyHex === undefined) {
      return false;
    }
    const salt = Buffer.from(saltHex, "hex");
    const stored = Buffer.from(keyHex, "hex");
    const derived = scryptSync(raw, salt, stored.length);
    return derived.length === stored.length && timingSafeEqual(derived, stored);
  }

  equals(other: Password): boolean {
    return this.hash === other.hash;
  }
}
