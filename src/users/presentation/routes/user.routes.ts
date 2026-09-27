import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import type {
  SignUpBody,
  SignUpController,
} from "../controllers/sign-up.controller";
import type {
  SignInBody,
  SignInController,
} from "../controllers/sign-in.controller";

export interface UserControllers {
  signUp: SignUpController;
  signIn: SignInController;
}

// Validação de FORMATO (shape) na borda — a validação de negócio (e-mail válido,
// força da senha) é do domínio.
const signUpBodySchema = {
  type: "object",
  required: ["name", "email", "password"],
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    password: { type: "string" },
  },
} as const;

const signInBodySchema = {
  type: "object",
  required: ["email", "password"],
  additionalProperties: false,
  properties: {
    email: { type: "string" },
    password: { type: "string" },
  },
} as const;

/**
 * Plugin de rotas do contexto `users`. Recebe os controllers já instanciados
 * (o composition root faz a injeção) e os liga às rotas HTTP.
 */
export function userRoutes(controllers: UserControllers): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: SignUpBody }>(
      "/users",
      { schema: { body: signUpBodySchema } },
      (request, reply) => controllers.signUp.handle(request, reply),
    );

    app.post<{ Body: SignInBody }>(
      "/sessions",
      { schema: { body: signInBodySchema } },
      (request, reply) => controllers.signIn.handle(request, reply),
    );
  };
}
