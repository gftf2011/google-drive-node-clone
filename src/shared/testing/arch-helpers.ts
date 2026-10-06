import type { Checkable } from "archunit";

/**
 * Executa uma regra do ArchUnitTS e falha o teste com uma mensagem legível
 * quando houver violações.
 *
 * O ArchUnitTS também expõe o matcher `toPassAsync`, porém formatamos as
 * violações manualmente para controlar a saída (origem → destino do import
 * proibido, ciclos e checagens customizadas) de forma estável sob Jest+ESM.
 */
export async function expectRuleToPass(rule: Checkable): Promise<void> {
  const violations = await rule.check();

  if (violations.length === 0) {
    return;
  }

  const details = violations.map(formatViolation).join("\n");
  throw new Error(
    `Regra arquitetural violada (${violations.length} ocorrência(s)):\n${details}`,
  );
}

function formatViolation(violation: unknown): string {
  const v = violation as Record<string, unknown>;

  // Violação de dependência proibida: { dependency: { sourceLabel, targetLabel } }
  const dependency = v.dependency as
    | { sourceLabel?: string; targetLabel?: string }
    | undefined;
  if (dependency?.sourceLabel && dependency?.targetLabel) {
    return `  • ${dependency.sourceLabel}  →  ${dependency.targetLabel}`;
  }

  // Violação de ciclo: { cycle: ProjectedEdge[] }
  const cycle = v.cycle as
    | Array<{ sourceLabel?: string; targetLabel?: string }>
    | undefined;
  if (Array.isArray(cycle) && cycle.length > 0) {
    const path = cycle
      .map((edge) => edge.sourceLabel)
      .filter(Boolean)
      .concat(cycle[cycle.length - 1]?.targetLabel ?? "")
      .join("  →  ");
    return `  • ciclo: ${path}`;
  }

  // Violação customizada (adhereTo): { message, fileInfo }
  const message = v.message as string | undefined;
  const fileInfo = v.fileInfo as { path?: string } | undefined;
  if (message) {
    return fileInfo?.path
      ? `  • ${fileInfo.path}: ${message}`
      : `  • ${message}`;
  }

  return `  • ${JSON.stringify(violation)}`;
}

/**
 * Bibliotecas de infraestrutura que não podem aparecer em camadas internas
 * (domínio). Apenas APIs nativas do Node (ex.: `node:crypto`) são permitidas.
 */
export const INFRA_LIBRARIES = [
  "fastify",
  "@prisma/client",
  "@prisma/adapter-pg",
  "@aws-sdk",
  "pg",
  "dotenv",
] as const;

const IMPORT_REGEX =
  /\bfrom\s+["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)/g;

/**
 * `true` quando o conteúdo do arquivo não importa nenhuma das bibliotecas de
 * infraestrutura listadas — usado em regras `adhereTo` de pureza do domínio.
 */
export function doesNotImportInfraLibraries(content: string): boolean {
  for (const match of content.matchAll(IMPORT_REGEX)) {
    const source = match[1] ?? match[2] ?? "";
    if (
      INFRA_LIBRARIES.some(
        (lib) => source === lib || source.startsWith(`${lib}/`),
      )
    ) {
      return false;
    }
  }
  return true;
}
