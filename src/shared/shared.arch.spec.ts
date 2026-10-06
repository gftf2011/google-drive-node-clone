/**
 * Cross-cutting architecture tests (ArchUnitTS).
 *
 * Cover rules that are not specific to a single bounded context: the role of
 * the shared base (`shared`) and the composition root (`main`), plus the
 * global absence of import cycles. Rules analyze the source statically via
 * `tsconfig.json` (no IO), so they run under the Jest `arch` project
 * (`*.arch.spec.ts`).
 */
import { projectFiles } from "archunit";

import { expectRuleToPass } from "./testing/arch-helpers";

const SHARED_DOMAIN = "**/shared/domain/**";
const SHARED_APPLICATION = "**/shared/application/**";
const SHARED_INFRA = "**/shared/infra/**";
const SHARED_PRESENTATION = "**/shared/presentation/**";

const ANY_INFRA = "**/infra/**";
const ANY_PRESENTATION = "**/presentation/**";

describe("Cross-cutting architecture", () => {
  describe("Shared base", () => {
    it("`shared` does not depend on feature modules (`drive`/`users`)", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder("**/shared/**")
          .shouldNot()
          .dependOnFiles()
          .inFolder("**/{drive,users}/**"),
      );
    });

    it("shared domain does not depend on infrastructure", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(SHARED_DOMAIN)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_INFRA),
      );
    });

    it("shared domain does not depend on presentation", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(SHARED_DOMAIN)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_PRESENTATION),
      );
    });

    it("shared application does not depend on infrastructure", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(SHARED_APPLICATION)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_INFRA),
      );
    });

    it("shared application does not depend on presentation", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(SHARED_APPLICATION)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_PRESENTATION),
      );
    });

    it("shared infrastructure does not depend on presentation", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(SHARED_INFRA)
          .shouldNot()
          .dependOnFiles()
          .inFolder(SHARED_PRESENTATION),
      );
    });
  });

  describe("Composition root (main)", () => {
    it("no module depends on `main` (only main knows the rest)", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder("**/{drive,users,shared}/**")
          .shouldNot()
          .dependOnFiles()
          .inFolder("**/main/**"),
      );
    });
  });

  describe("Dependency cycles", () => {
    it("there are no import cycles between files (ignoring generated code)", async () => {
      // A pasta `prisma/generated` é código gerado e possui ciclos próprios
      // fora do nosso controle — fica de fora da checagem.
      await expectRuleToPass(
        projectFiles()
          .inFolder("**", { except: { inFolder: "**/generated/**" } })
          .should()
          .haveNoCycles(),
      );
    });
  });
});
