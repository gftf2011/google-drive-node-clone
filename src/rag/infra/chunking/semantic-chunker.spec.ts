import type { Embedder } from "../../application/ports/embedding/embedder";
import type { ExtractedDocument } from "../../application/ports/extraction/document-extractor";

import { SemanticChunker } from "./semantic-chunker";

// Embedder determinístico: vetores ortogonais por "assunto" (gato vs. cachorro),
// então frases do mesmo assunto têm distância 0 e de assuntos diferentes, 1.
const fakeEmbedder: Embedder = {
  embed: async (texts) =>
    texts.map((t) => (t.toLowerCase().includes("gato") ? [1, 0] : [0, 1])),
};

function doc(elements: ExtractedDocument["elements"]): ExtractedDocument {
  return { text: "", elements, metadata: {}, extractor: "test" };
}

const options = { maxChars: 1000, minChars: 1, breakpointPercentile: 50 };

describe("SemanticChunker", () => {
  it("corta o texto narrativo na fronteira semântica (mudança de assunto)", async () => {
    const chunker = new SemanticChunker(fakeEmbedder, options);
    const chunks = await chunker.chunk(
      doc([
        {
          type: "NarrativeText",
          text: "O gato dorme. O gato mia. O cachorro late. O cachorro corre.",
        },
      ]),
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.text).toContain("gato");
    expect(chunks[0]!.text).not.toContain("cachorro");
    expect(chunks[1]!.text).toContain("cachorro");
  });

  it("preserva a tabela como um chunk atômico", async () => {
    const chunker = new SemanticChunker(fakeEmbedder, options);
    const chunks = await chunker.chunk(
      doc([
        { type: "NarrativeText", text: "Antes da tabela." },
        { type: "Table", text: "<table><tr><td>a</td><td>b</td></tr></table>" },
        { type: "NarrativeText", text: "Depois da tabela." },
      ]),
    );

    const table = chunks.find((c) => c.kind === "table");
    expect(table).toBeDefined();
    expect(table!.text).toBe("<table><tr><td>a</td><td>b</td></tr></table>");
    // A tabela não se funde com o texto ao redor.
    expect(chunks.filter((c) => c.kind === "narrative").length).toBe(2);
  });

  it("abre uma seção no cabeçalho e propaga a trilha nos chunks", async () => {
    const chunker = new SemanticChunker(fakeEmbedder, options);
    const chunks = await chunker.chunk(
      doc([
        { type: "Title", text: "Introdução" },
        { type: "NarrativeText", text: "O gato dorme." },
      ]),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.headingTrail).toEqual(["Introdução"]);
  });

  it("corta por tamanho mesmo sem quebra semântica (respeita maxChars)", async () => {
    const chunker = new SemanticChunker(fakeEmbedder, {
      ...options,
      maxChars: 20,
    });
    // Mesmo assunto (sem quebra semântica), mas a soma estoura maxChars — o corte
    // acontece na fronteira de frase, nunca no meio de uma.
    const chunks = await chunker.chunk(
      doc([{ type: "NarrativeText", text: "O gato dorme. O gato mia." }]),
    );

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(20);
    }
  });
});
