import type { FastifyReply, FastifyRequest } from "fastify";

import type { UseCase } from "../../../shared/application/use-case";
import type {
  SignInInput,
  SignInOutput,
} from "../../application/use-cases/sign-in.use-case";

export interface SignInBody {
  email: string;
  password: string;
}

/**
 * Controller HTTP da autenticação. Apenas traduz request → input e output →
 * response; nenhuma regra de negócio.
 */
export class SignInController {
  constructor(private readonly signIn: UseCase<SignInInput, SignInOutput>) {}

  async handle(
    request: FastifyRequest<{ Body: SignInBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { email, password } = request.body;
    const output = await this.signIn.execute({ email, password });
    await reply.status(200).send(output);
  }
}
