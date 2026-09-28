import type { FastifyReply, FastifyRequest } from "fastify";

import type { TokenVerifier } from "../../application/ports/providers/token-verifier";
import { UnauthenticatedError } from "../../domain/errors/unauthenticated.error";

import { AuthenticateMiddleware } from "./authenticate.middleware";

const payload = {
  sub: "11111111-1111-1111-1111-111111111111",
  name: "Jane Doe",
  email: "jane@example.com",
};

function requestWith(authorization?: string): FastifyRequest {
  return { headers: { authorization } } as unknown as FastifyRequest;
}

const reply = {} as FastifyReply;

describe("AuthenticateMiddleware", () => {
  it("attaches the authenticated user from a valid Bearer token", async () => {
    const verifier: TokenVerifier = {
      verify: jest.fn().mockResolvedValue(payload),
    };
    const middleware = new AuthenticateMiddleware(verifier);
    const request = requestWith("Bearer valid-token");

    await middleware.handle(request, reply);

    expect(verifier.verify).toHaveBeenCalledWith("valid-token");
    expect(request.authUser).toEqual({
      id: payload.sub,
      name: payload.name,
      email: payload.email,
    });
  });

  it("rejects a request without an Authorization header", async () => {
    const verifier: TokenVerifier = { verify: jest.fn() };
    const middleware = new AuthenticateMiddleware(verifier);

    await expect(
      middleware.handle(requestWith(), reply),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("rejects a header that is not a Bearer scheme", async () => {
    const verifier: TokenVerifier = { verify: jest.fn() };
    const middleware = new AuthenticateMiddleware(verifier);

    await expect(
      middleware.handle(requestWith("Basic abc"), reply),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("propagates the verifier failure for an invalid token", async () => {
    const verifier: TokenVerifier = {
      verify: jest.fn().mockRejectedValue(new UnauthenticatedError()),
    };
    const middleware = new AuthenticateMiddleware(verifier);

    await expect(
      middleware.handle(requestWith("Bearer bad"), reply),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
