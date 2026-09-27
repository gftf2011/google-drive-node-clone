import { CreateRootFolderOnUserCreated } from "../folders/application/event-handlers/create-root-folder-on-user-created";
import { CreateRootFolder } from "../folders/application/use-cases/create-root-folder.use-case";
import { InMemoryFolderRepository } from "../folders/infra/persistence/in-memory-folder-repository";
import { InProcessEventDispatcher } from "../shared/infra/events/in-process-event-dispatcher";
import { SignIn } from "../users/application/use-cases/sign-in.use-case";
import { SignUp } from "../users/application/use-cases/sign-up.use-case";
import { UserCreated } from "../users/domain/events/user-created.event";
import { InMemoryUserRepository } from "../users/infra/persistence/in-memory-user-repository";
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
 * contextos ao mesmo tempo. Para migrar de in-memory para Prisma, troca-se
 * apenas as implementações dos repositórios aqui.
 */
export function buildContainer(env: Env): Container {
  // --- Adapters de saída (infra) ---
  const userRepository = new InMemoryUserRepository();
  const folderRepository = new InMemoryFolderRepository();
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
  const signUp = new SignUp(userRepository, eventPublisher, tokenGenerator);
  const signIn = new SignIn(userRepository, tokenGenerator);

  // --- Controllers (presentation) ---
  return {
    userControllers: {
      signUp: new SignUpController(signUp),
      signIn: new SignInController(signIn),
    },
  };
}
