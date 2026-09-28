import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../shared/infra/database/prisma/generated/client";
import { PrismaTransactionContext } from "../../../shared/infra/database/prisma/prisma-transaction-context";
import { startPostgres } from "../../../shared/testing/containers";
import type { StartedPostgres } from "../../../shared/testing/containers";
import { User } from "../../domain/aggregates/user";

import { PrismaUserRepository } from "./prisma-user-repository";

let postgres: StartedPostgres;
let closeDatabase: () => Promise<void>;
let users: PrismaUserRepository;

beforeAll(async () => {
  postgres = await startPostgres();
  const client = await import(
    "../../../shared/infra/database/prisma/client"
  );
  closeDatabase = client.closeDatabase;
  users = new PrismaUserRepository(
    new PrismaTransactionContext(client.prisma as PrismaClient),
  );
});

afterAll(async () => {
  await closeDatabase?.();
  await postgres?.container.stop();
});

function newUser(): User {
  return User.create({
    name: "Jane Doe",
    email: `user-${randomUUID()}@example.com`,
    password: "password123",
  });
}

describe("PrismaUserRepository", () => {
  it("saves a user and finds it by email", async () => {
    const user = newUser();
    await users.save(user);

    const found = await users.findByEmail(user.email.value);
    expect(found).not.toBeNull();
    expect(found?.id.value).toBe(user.id.value);
    expect(found?.password.matches("password123")).toBe(true);
  });

  it("reports whether an email is already in use", async () => {
    const user = newUser();
    expect(await users.existsByEmail(user.email.value)).toBe(false);
    await users.save(user);
    expect(await users.existsByEmail(user.email.value)).toBe(true);
  });

  it("returns null for an unknown email", async () => {
    expect(await users.findByEmail("nobody@example.com")).toBeNull();
  });
});
