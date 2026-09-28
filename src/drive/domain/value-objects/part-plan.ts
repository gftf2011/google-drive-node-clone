const MIB = 1024 * 1024;

/** Limites do multipart no S3. */
const MIN_PART_SIZE = 5 * MIB; // 5 MiB (não se aplica à última/única parte)
const MAX_PART_SIZE = 5 * 1024 * MIB; // 5 GiB
const MAX_PARTS = 10_000;
/** Tamanho de parte padrão quando o cliente não sugere um. */
const DEFAULT_PART_SIZE = 8 * MIB;

/**
 * Plano de fatiamento de um arquivo em partes — quantas partes e de que tamanho.
 *
 * É o backend que decide (e informa ao front) como picotar o upload, respeitando
 * as regras do S3: parte de no mínimo 5 MiB e no máximo 10.000 partes. Se o
 * tamanho pedido geraria partes demais, o plano aumenta a parte automaticamente
 * para caber no teto — o front recebe o `partSize` final e fatia por ele.
 */
export class PartPlan {
  private constructor(
    public readonly partSize: number,
    public readonly partCount: number,
  ) {}

  static for(props: { size: number; requestedPartSize?: number }): PartPlan {
    const requested = props.requestedPartSize ?? DEFAULT_PART_SIZE;
    // Piso de 5 MiB (mínimo do S3 para uploads com mais de uma parte) e teto de
    // 5 GiB (máximo por parte).
    const clamped = Math.min(
      Math.max(requested, MIN_PART_SIZE),
      MAX_PART_SIZE,
    );
    // Cresce a parte, se preciso, para nunca passar de 10.000 partes.
    const minForMaxParts = Math.ceil(props.size / MAX_PARTS);
    const partSize = Math.max(clamped, minForMaxParts);
    const partCount = Math.max(1, Math.ceil(props.size / partSize));
    return new PartPlan(partSize, partCount);
  }
}
