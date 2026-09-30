import type {
  Chunk,
  Chunker,
} from "../../application/ports/chunking/chunker";
import type { Embedder } from "../../application/ports/embedding/embedder";
import type {
  ExtractedDocument,
  ExtractedElement,
} from "../../application/ports/extraction/document-extractor";

export interface SemanticChunkerOptions {
  /** Teto de tamanho de um chunk narrativo, em caracteres. */
  maxChars: number;
  /** Piso: chunks menores que isto são fundidos ao anterior. */
  minChars: number;
  /**
   * Percentil das distâncias entre frases que define a fronteira semântica:
   * ex.: 90 corta nos ~10% de maiores "saltos" de assunto. Maior = menos cortes.
   */
  breakpointPercentile: number;
}

const HEADING_TYPES = new Set(["title", "header", "sectionheader", "heading"]);

/**
 * Chunker ESTRUTURA-PRIMEIRO com corte semântico no texto narrativo.
 *
 * Percorre os elementos extraídos preservando a estrutura que o extrator já
 * entregou (Docling/Unstructured):
 *   - um `Title`/`Header` abre uma nova seção e entra na trilha de cabeçalhos;
 *   - uma `Table` vira um chunk ATÔMICO (nunca dividida nem fundida);
 *   - texto narrativo é acumulado por seção e, ao fechar a seção, cortado em
 *     fronteiras SEMÂNTICAS: embeddamos as frases e quebramos onde a distância
 *     entre frases vizinhas passa de um percentil (respeitando `maxChars`).
 *
 * Assim nunca se corta no meio de uma frase, de uma seção ou de uma tabela.
 */
export class SemanticChunker implements Chunker {
  constructor(
    private readonly embedder: Embedder,
    private readonly options: SemanticChunkerOptions,
  ) {}

  async chunk(document: ExtractedDocument): Promise<Chunk[]> {
    const chunks: Chunk[] = [];
    let headingTrail: string[] = [];
    let narrative: ExtractedElement[] = [];

    // Fecha a seção narrativa corrente: corta em fronteiras semânticas e emite.
    const flushNarrative = async (): Promise<void> => {
      const elements = narrative;
      narrative = [];
      const text = elements
        .map((e) => e.text)
        .join("\n")
        .trim();
      if (text.length === 0) {
        return;
      }
      // Página = a 1ª dos elementos da seção; metadado = o do documento + os
      // tipos de elemento abrangidos (herança documento → chunk).
      const page = elements.find((e) => e.page !== undefined)?.page ?? null;
      const metadata = {
        ...document.metadata,
        elementTypes: [...new Set(elements.map((e) => e.type))],
      };
      for (const piece of await this.splitSemantically(text)) {
        chunks.push({
          index: chunks.length,
          text: piece,
          kind: "narrative",
          headingTrail: [...headingTrail],
          charCount: piece.length,
          page,
          metadata,
        });
      }
    };

    for (const element of document.elements) {
      const type = element.type.toLowerCase();

      if (HEADING_TYPES.has(type)) {
        // Novo cabeçalho fecha a seção anterior e vira o contexto atual.
        await flushNarrative();
        headingTrail = [element.text.trim()];
        continue;
      }

      if (type.includes("table")) {
        // Tabela: fecha a narrativa e emite a tabela inteira como um chunk,
        // preservando o metadado (ex.: `text_as_html`) que a ferramenta deu.
        await flushNarrative();
        chunks.push({
          index: chunks.length,
          text: element.text,
          kind: "table",
          headingTrail: [...headingTrail],
          charCount: element.text.length,
          page: element.page ?? null,
          metadata: { ...document.metadata, ...element.metadata },
        });
        continue;
      }

      narrative.push(element);
    }

    await flushNarrative();
    // Se o extrator só devolveu texto plano (um único elemento "Document"),
    // ainda assim caímos no corte semântico acima — nada é cortado ao meio.
    return chunks;
  }

  /**
   * Corta um bloco de texto em fronteiras semânticas: frase a frase, quebra
   * onde a distância de cosseno entre frases vizinhas passa do percentil
   * configurado, ou quando o chunk corrente atingiria `maxChars`.
   */
  private async splitSemantically(text: string): Promise<string[]> {
    const sentences = this.splitSentences(text);
    if (sentences.length <= 1) {
      return sentences.length === 1 ? [sentences[0]!] : [];
    }

    const vectors = await this.embedder.embed(sentences);
    const distances: number[] = [];
    for (let i = 1; i < vectors.length; i++) {
      distances.push(1 - this.dot(vectors[i - 1]!, vectors[i]!));
    }
    const threshold = this.percentile(distances, this.options.breakpointPercentile);

    const pieces: string[] = [];
    let current = sentences[0]!;
    for (let i = 1; i < sentences.length; i++) {
      const wouldOverflow =
        current.length + 1 + sentences[i]!.length > this.options.maxChars;
      const isSemanticBreak = distances[i - 1]! > threshold;
      if (wouldOverflow || isSemanticBreak) {
        pieces.push(current);
        current = sentences[i]!;
      } else {
        current = `${current} ${sentences[i]!}`;
      }
    }
    pieces.push(current);

    return this.mergeTinyPieces(pieces);
  }

  /** Segmentação de frases via `Intl.Segmenter` (sem dependências externas). */
  private splitSentences(text: string): string[] {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
    return [...segmenter.segment(text)]
      .map((s) => s.segment.trim())
      .filter((s) => s.length > 0);
  }

  /** Funde pedaços menores que `minChars` ao anterior, evitando chunks minúsculos. */
  private mergeTinyPieces(pieces: string[]): string[] {
    const merged: string[] = [];
    for (const piece of pieces) {
      const previous = merged[merged.length - 1];
      if (
        previous !== undefined &&
        piece.length < this.options.minChars &&
        previous.length + 1 + piece.length <= this.options.maxChars
      ) {
        merged[merged.length - 1] = `${previous} ${piece}`;
      } else {
        merged.push(piece);
      }
    }
    return merged;
  }

  /** Produto interno — cosseno, já que os vetores vêm normalizados. */
  private dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i]! * b[i]!;
    }
    return sum;
  }

  /** Percentil por interpolação linear sobre as distâncias ordenadas. */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const rank = (p / 100) * (sorted.length - 1);
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    if (low === high) {
      return sorted[low]!;
    }
    return sorted[low]! + (rank - low) * (sorted[high]! - sorted[low]!);
  }
}
