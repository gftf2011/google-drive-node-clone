import { UnauthenticatedError } from "../../domain/errors/unauthenticated.error";

import { JwtTokenGenerator } from "./jwt-token-generator";
import { JwtTokenVerifier } from "./jwt-token-verifier";

const secret = "test-secret-with-more-than-32-characters-abc";
const payload = {
  sub: "11111111-1111-1111-1111-111111111111",
  name: "Jane Doe",
  email: "jane@example.com",
};

describe("JWT generator and verifier", () => {
  it("verifies a token it generated (round-trip)", async () => {
    const token = await new JwtTokenGenerator({
      secret,
      expiresInSeconds: 3600,
    }).generate(payload);

    const claims = await new JwtTokenVerifier({ secret }).verify(token);
    expect(claims).toEqual(payload);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await new JwtTokenGenerator({
      secret,
      expiresInSeconds: 3600,
    }).generate(payload);

    const verifier = new JwtTokenVerifier({ secret: "another-secret-value" });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("rejects a tampered payload", async () => {
    const token = await new JwtTokenGenerator({
      secret,
      expiresInSeconds: 3600,
    }).generate(payload);
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...payload, sub: "intruder" }),
    ).toString("base64url");

    const verifier = new JwtTokenVerifier({ secret });
    await expect(
      verifier.verify(`${header}.${forged}.${signature}`),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("rejects an expired token", async () => {
    const token = await new JwtTokenGenerator({
      secret,
      expiresInSeconds: -1,
    }).generate(payload);

    await expect(
      new JwtTokenVerifier({ secret }).verify(token),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("rejects a malformed token", async () => {
    await expect(
      new JwtTokenVerifier({ secret }).verify("not-a-jwt"),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
