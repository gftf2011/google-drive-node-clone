/**
 * Jest em modo ESM (o client gerado do Prisma usa `import.meta`, então não dá
 * para transpilar para CommonJS). Transformação via `@swc/jest` emitindo ES
 * modules — sem `tsc`, evitando o conflito de peer do TypeScript 7.
 *
 * Três projetos, distinguidos pelo sufixo do arquivo, todos sob `src/`:
 *   - unit:        `*.spec.ts`      (puro, sem IO)
 *   - integration: `*.int.spec.ts`  (infra real via testcontainers)
 *   - e2e:         `*.e2e.spec.ts`   (rotas ponta a ponta)
 *
 * Rode com `--experimental-vm-modules` (já embutido nos scripts `test*`).
 */
const swc = [
  "@swc/jest",
  {
    jsc: { parser: { syntax: "typescript" }, target: "es2022" },
    module: { type: "es6" },
  },
];

const base = {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  transform: { "^.+\\.ts$": swc },
  // Expõe o objeto `jest` como global (não injetado em ESM). Ver jest-setup.ts.
  setupFiles: ["<rootDir>/src/shared/testing/jest-setup.ts"],
  testTimeout: 240_000,
};

export default {
  projects: [
    {
      ...base,
      displayName: "unit",
      testMatch: ["<rootDir>/src/**/*.spec.ts"],
      testPathIgnorePatterns: ["\\.int\\.spec\\.ts$", "\\.e2e\\.spec\\.ts$"],
    },
    {
      ...base,
      displayName: "integration",
      testMatch: ["<rootDir>/src/**/*.int.spec.ts"],
    },
    {
      ...base,
      displayName: "e2e",
      testMatch: ["<rootDir>/src/**/*.e2e.spec.ts"],
    },
  ],
};
