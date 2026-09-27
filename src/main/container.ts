import { CreateRootFolderOnUserCreated } from "../folders/application/event-handlers/create-root-folder-on-user-created";
import { CreateRootFolder } from "../folders/application/use-cases/create-root-folder.use-case";
import { PrismaFolderRepository } from "../folders/infra/persistence/prisma-folder-repository";
import { TransactionalUseCase } from "../shared/application/transactional-use-case";
import { prisma } from "../shared/infra/database/prisma/client";
import { PrismaTransactionContext } from "../shared/infra/database/prisma/prisma-transaction-context";
import { InProcessEventDispatcher } from "../shared/infra/events/in-process-event-dispatcher";
import { SignIn } from "../users/application/use-cases/sign-in.use-case";
import { SignUp } from "../users/application/use-cases/sign-up.use-case";
import { UserCreated } from "../users/domain/events/user-created.event";
import { PrismaUserRepository } from "../users/infra/persistence/prisma-user-repository";
import { JwtTokenGenerator } from "../users/infra/providers/jwt-token-generator";
import { SignInController } from "../users/presentation/controllers/sign-in.controller";
import { SignUpController } from "../users/presentation/controllers/sign-up.controller";
import type { UserControllers } from "../users/presentation/routes/user.routes";

import type { Env } from "./config/env";

export interface Container {
  userControllers: UserControllers;
}

/**
 * Composition root: instancia os adapters, injeta as dependências e registra os
 * handlers de eventos entre contextos. É o ÚNICO lugar que conhece todos os
 * contextos ao mesmo tempo. Trocar a implementação de qualquer adapter (ex.: o
 * repositório) afeta apenas este arquivo — o domínio e a aplicação não mudam.
 */
export function buildContainer(env: Env): Container {
  // --- Transação/UoW: o mesmo contexto provê o client corrente aos repos e a
  // fronteira transacional (via AsyncLocalStorage). ---
  const unitOfWork = new PrismaTransactionContext(prisma);

  // --- Adapters de saída (infra) ---
  const userRepository = new PrismaUserRepository(unitOfWork);
  const folderRepository = new PrismaFolderRepository(unitOfWork);
  const tokenGenerator = new JwtTokenGenerator({
    secret: env.jwt.secret,
    expiresInSeconds: env.jwt.expiresInSeconds,
  });

  // --- Eventos: dispatcher síncrono + fiação cross-context (users -> folders) ---
  const eventPublisher = new InProcessEventDispatcher();
  eventPublisher.register(
    UserCreated.EVENT_NAME,
    new CreateRootFolderOnUserCreated(new CreateRootFolder(folderRepository)),
  );

  // --- Casos de uso ---
  // SignUp muta estado (usuário + pasta raiz via evento) → decorado com a UoW,
  // para commitar tudo atomicamente. SignIn é somente leitura → sem transação.
  const signUp = new TransactionalUseCase(
    new SignUp(userRepository, eventPublisher, tokenGenerator),
    unitOfWork,
  );
  const signIn = new SignIn(userRepository, tokenGenerator);

  // --- Controllers (presentation) ---
  return {
    userControllers: {
      signUp: new SignUpController(signUp),
      signIn: new SignInController(signIn),
    },
  };
}
