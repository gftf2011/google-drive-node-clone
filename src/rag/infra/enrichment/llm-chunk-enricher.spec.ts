import type { TextGenerator } from "../../application/ports/enrichment/text-generator";

import { LlmChunkEnricher } from "./llm-chunk-enricher";

const options = { maxKeywords: 3, maxQuestions: 2, maxInputChars: 1000 };

function enricher(generate: jest.Mock): LlmChunkEnricher {
  const generator: TextGenerator = { generate };
  return new LlmChunkEnricher(generator, options);
}

const input = { text: "Um texto qualquer.", headingTrail: ["Seção"], language: "pt" };

describe("LlmChunkEnricher", () => {
  it("parseia o JSON do LLM em resumo, keywords e perguntas", async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({
        summary: "Um resumo.",
        keywords: ["a", "b"],
        hypothetical_questions: ["O que é a?"],
      }),
    );

    const result = await enricher(generate).enrich(input);

    expect(result.summary).toBe("Um resumo.");
    expect(result.keywords).toEqual(["a", "b"]);
    expect(result.hypotheticalQuestions).toEqual(["O que é a?"]);
    // Pediu JSON ao gerador.
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ json: true }),
    );
  });

  it("tolera cercas de código/prosa ao redor do JSON", async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        'Claro!\n```json\n{"summary":"s","keywords":[],"hypothetical_questions":[]}\n```',
      );

    const result = await enricher(generate).enrich(input);

    expect(result.summary).toBe("s");
  });

  it("aplica os limites de keywords e perguntas", async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({
        summary: "s",
        keywords: ["a", "b", "c", "d", "e"],
        hypothetical_questions: ["q1", "q2", "q3"],
      }),
    );

    const result = await enricher(generate).enrich(input);

    expect(result.keywords).toHaveLength(3);
    expect(result.hypotheticalQuestions).toHaveLength(2);
  });

  it("degrada para vazio quando o JSON é inválido", async () => {
    const result = await enricher(
      jest.fn().mockResolvedValue("não sou json"),
    ).enrich(input);

    expect(result).toEqual({
      summary: "",
      keywords: [],
      hypotheticalQuestions: [],
    });
  });

  it("degrada para vazio quando o LLM falha (nunca lança)", async () => {
    const result = await enricher(
      jest.fn().mockRejectedValue(new Error("timeout")),
    ).enrich(input);

    expect(result.summary).toBe("");
    expect(result.keywords).toEqual([]);
  });
});
