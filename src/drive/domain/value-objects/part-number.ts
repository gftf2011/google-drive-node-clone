import { InvalidPartNumberError } from "../errors/invalid-part-number.error";

/** O S3 numera as partes de 1 a 10.000. */
const MIN = 1;
const MAX = 10_000;

/**
 * Número de uma parte no multipart upload.
 *
 * As partes são 1-indexadas e vão até 10.000 (limite do S3). É este número, com
 * a `UploadId` do storage, que identifica cada parte ao assiná-la e ao concluir.
 */
export class PartNumber {
  private constructor(public readonly value: number) {}

  static create(raw: number): PartNumber {
    if (!Number.isInteger(raw) || raw < MIN || raw > MAX) {
      throw new InvalidPartNumberError(raw);
    }
    return new PartNumber(raw);
  }

  equals(other: PartNumber): boolean {
    return this.value === other.value;
  }
}
