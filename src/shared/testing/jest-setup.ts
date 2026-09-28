import { jest } from "@jest/globals";

/**
 * Em ESM, o jest injeta `describe`/`it`/`expect` como globais, mas NÃO o objeto
 * utilitário `jest` (mocks). Aqui o expomos globalmente uma única vez, para os
 * specs usarem `jest.fn()` sem precisar importá-lo em cada arquivo — e com a
 * tipagem leniente do `@types/jest`.
 */
(globalThis as unknown as { jest: typeof jest }).jest = jest;
