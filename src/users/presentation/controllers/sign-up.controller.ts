import type { FastifyReply, FastifyRequest } from "fastify";

import type { SignUp } from "../../application/use-cases/sign-up.use-case";

export interface SignUpBody {
  name: string;
  email: string;
  password: string;
}

/**
 * Controller HTTP do cadastro. Apenas traduz request → input e output →
 * response; nenhuma regra de negócio. Erros de domínio sobem para o error
 * handler global.
 */
export class SignUpController {
  constructor(private readonly signUp: SignUp) {}

  async handle(
    request: FastifyRequest<{ Body: SignUpBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { name, email, password } = request.body;
    const output = await this.signUp.execute({ name, email, password });
    await reply.status(201).send(output);
  }
}
