/**
 * Architecture tests for the `users` bounded context (ArchUnitTS).
 *
 * Enforce the Clean Architecture dependency rule inside the module (layers
 * always point inward), the domain purity and the module's independence from
 * the `drive` context. Rules analyze the source statically via `tsconfig.json`
 * (no IO), so they run under the Jest `arch` project (`*.arch.spec.ts`).
 */
import { projectFiles } from "archunit";

import {
  doesNotImportInfraLibraries,
  expectRuleToPass,
} from "../shared/testing/arch-helpers";

// Seleção: apenas arquivos do módulo `users`.
const USERS_DOMAIN = "**/users/domain/**";
const USERS_APPLICATION = "**/users/application/**";
const USERS_INFRA = "**/users/infra/**";
const USERS_PRESENTATION = "**/users/presentation/**";

// Dependências proibidas: qualquer módulo (o import pode vazar via shared/drive).
const ANY_APPLICATION = "**/application/**";
const ANY_INFRA = "**/infra/**";
const ANY_PRESENTATION = "**/presentation/**";

describe("Users module architecture", () => {
  describe("Dependency rule (layers point inward)", () => {
    it("domain does not depend on application", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(USERS_DOMAIN)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_APPLICATION),
      );
    });

    it("domain does not depend on infrastructure", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(USERS_DOMAIN)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_INFRA),
      );
    });

    it("domain does not depend on presentation", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(USERS_DOMAIN)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_PRESENTATION),
      );
    });

    it("application does not depend on infrastructure", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(USERS_APPLICATION)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_INFRA),
      );
    });

    it("application does not depend on presentation", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(USERS_APPLICATION)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_PRESENTATION),
      );
    });

    it("presentation does not depend on infrastructure", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(USERS_PRESENTATION)
          .shouldNot()
          .dependOnFiles()
          .inFolder(ANY_INFRA),
      );
    });

    it("infrastructure does not depend on presentation", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder(USERS_INFRA)
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
          .inFolder(USERS_DOMAIN)
          .should()
          .adhereTo(
            (file) => doesNotImportInfraLibraries(file.content),
            "domain files must not import infrastructure libraries",
          ),
      );
    });
  });

  describe("Bounded context independence", () => {
    it("the core (domain+application) does not depend on `drive`", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder("**/users/{domain,application}/**")
          .shouldNot()
          .dependOnFiles()
          .inFolder("**/drive/**"),
      );
    });
  });

  describe("Naming conventions", () => {
    it("controllers are named `*.controller.ts`", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder("**/users/presentation/controllers/**")
          .should()
          .haveName("*.controller.ts"),
      );
    });

    it("domain errors are named `*.error.ts`", async () => {
      await expectRuleToPass(
        projectFiles()
          .inFolder("**/users/domain/errors/**")
          .should()
          .haveName("*.error.ts"),
      );
    });
  });
});
