import type {
  DocumentExtractor,
  ExtractInput,
  ExtractedDocument,
} from "../../application/ports/extraction/document-extractor";

/** Resposta (parcial) do docling-serve em `/v1/convert/source`. */
interface DoclingResponse {
  document?: {
    md_content?: string | null;
    text_content?: string | null;
    json_content?: unknown;
  };
}

/**
 * Adapter de extração via Docling (docling-serve, `/v1/convert/source`).
 *
 * Docling é especialista em PDF: entende LAYOUT (colunas, cabeçalhos, tabelas,
 * ordem de leitura) e devolve Markdown estruturado de alta fidelidade. Usamos o
 * endpoint `/source`, entregando a URL assinada do objeto — o PRÓPRIO serviço
 * baixa o arquivo do storage. Assim os bytes nunca passam pela memória do
 * worker, o que importa muito para PDFs grandes.
 */
export class DoclingDocumentExtractor implements DocumentExtractor {
  constructor(private readonly baseUrl: string) {}

  async extract(input: ExtractInput): Promise<ExtractedDocument> {
    const response = await fetch(`${this.baseUrl}/v1/convert/source`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        // Docling puxa o arquivo direto da URL assinada (HTTP source).
        sources: [{ kind: "http", url: input.sourceUrl }],
        // Pedimos Markdown: preserva títulos, listas e tabelas do PDF.
        options: { to_formats: ["md"] },
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Docling respondeu ${response.status} ao extrair "${input.fileName}".`,
      );
    }

    const parsed = (await response.json()) as DoclingResponse;
    const text = (
      parsed.document?.md_content ??
      parsed.document?.text_content ??
      ""
    ).trim();

    return {
      text,
      elements: text.length > 0 ? [{ type: "Document", text }] : [],
      metadata:
        parsed.document?.json_content === undefined
          ? {}
          : { docling: parsed.document.json_content },
      extractor: "docling",
    };
  }
}
