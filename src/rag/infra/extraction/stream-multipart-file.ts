import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

export interface StreamMultipartFileInput {
  /** Nome do campo do formulário (ex.: "files"). */
  field: string;
  fileName: string;
  /** Content-Type do arquivo dentro da parte. */
  fileContentType: string;
  /** Stream dos bytes do arquivo. */
  stream: Readable;
}

export interface StreamMultipartBody {
  /** Corpo `multipart/form-data` como stream (não bufferiza o arquivo). */
  body: Readable;
  /** Valor do header `Content-Type`, com o boundary. */
  contentType: string;
}

/**
 * Monta um corpo `multipart/form-data` de UM arquivo por STREAMING.
 *
 * O `FormData`/`Blob` do runtime bufferiza o conteúdo em memória — inviável para
 * arquivos de GBs. Aqui compomos o envelope multipart à mão em volta do stream:
 * emitimos o preâmbulo, repassamos os chunks do arquivo conforme chegam e
 * fechamos com o epílogo. A memória fica O(chunk).
 */
export function streamMultipartFile(
  input: StreamMultipartFileInput,
): StreamMultipartBody {
  const boundary = `----gdrive-${randomUUID()}`;
  const preamble =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${input.field}"; ` +
    `filename="${input.fileName.replace(/"/g, "")}"\r\n` +
    `Content-Type: ${input.fileContentType}\r\n\r\n`;
  const epilogue = `\r\n--${boundary}--\r\n`;

  async function* parts(): AsyncGenerator<Buffer> {
    yield Buffer.from(preamble, "utf8");
    for await (const chunk of input.stream) {
      yield chunk as Buffer;
    }
    yield Buffer.from(epilogue, "utf8");
  }

  return {
    body: Readable.from(parts()),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
