/**
 * Architecture tests for the `drive` bounded context (ArchUnitTS).
 *
 * Enforce the Clean Architecture dependency rule inside the module (layers
 * always point inward), the domain purity and the module's independence from
 * the `users` context. Rules analyze the source statically via `tsconfig.json`
 * (no IO), so they run under the Jest `arch` project (`*.arch.spec.ts`).
 */
import { projectFiles } from "archunit";

import {
  doesNotImportInfraLibraries,
  expectRuleToPass,
} from "../shared/testing/arch-helpers";

// Seleção: apenas arquivos do módulo `drive`.
const DRIVE_DOMAIN = "**/drive/domain/**";
const DRIVE_APPLICATION = "**/drive/application/**";
const DRIVE_INFRA = "**/drive/infra/**";
const DRIVE_PRESENTATION = "**/drive/presentation/**";

// Dependências proibidas: qualquer módulo (o import pode vazar via shared/users).
const ANY_APPLICATION = "**/application/**";
const ANY_INFRA = "**/infra/**";
const ANY_PRESENTATION = "**/presentation/**";

describe("Drive module architecture", () => {
  describe("Dependency rule (layers point inward)", () => {
    it("domain does not depend on application (except the shared ListSort type)", async () => {
      // `shared/application/list-sort` é um type puro (`"recent" | "name"`)
      // usado por interfaces de repositório do domínio — única exceção tolerada.
      await expectRuleToPass(
        projectFiles()
          .inFolder(DRIVE_DOMAIN)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_APPLICATION, { except: { withName: "list-sort.ts" } }),
      );
    });

    it("domain does not depend on infrastructure", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(DRIVE_DOMAIN)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_INFRA),
      );
    });

    it("domain does not depend on presentation", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(DRIVE_DOMAIN)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_PRESENTATION),
      );
    });

    it("application does not depend on infrastructure", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(DRIVE_APPLICATION)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_INFRA),
      );
    });

    it("application does not depend on presentation", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(DRIVE_APPLICATION)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_PRESENTATION),
      );
    });

    it("presentation does not depend on infrastructure", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(DRIVE_PRESENTATION)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_INFRA),
      );
    });

    it("infrastructure does not depend on presentation", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(DRIVE_INFRA)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_PRESENTATION),
      );
    });
  });

  describe("Domain purity", () => {
    it("domain does not import infrastructure frameworks/libraries", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(DRIVE_DOMAIN)
          .should()
          .adhereTo(
            (file) => doesNotImportInfraLibraries(file.content),
            "domain files must not import infrastructure libraries",
          ),
      );
    });
  });

  describe("Bounded context independence", () => {
    it("the core (domain+application) does not depend on `users`", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder("**/drive/{domain,application}/**")
          .shouldNot()
          .dependOnFiles()
          .inFolder("**/users/**"),
      );
    });
  });

  describe("Naming conventions", () => {
    it("controllers are named `*.controller.ts`", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder("**/drive/presentation/controllers/**")
          .should()
          .haveName("*.controller.ts"),
      );
    });

    it("domain errors are named `*.error.ts`", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder("**/drive/domain/errors/**")
          .should()
          .haveName("*.error.ts"),
      );
    });
  });
});
