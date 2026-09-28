import { randomBytes, randomUUID } from "node:crypto";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import request from "supertest";

import { startAppEnvironment } from "../../shared/testing/app-environment";
import type { AppEnvironment } from "../../shared/testing/app-environment";

let env: AppEnvironment;
let s3: S3Client;

beforeAll(async () => {
  env = await startAppEnvironment();
  s3 = new S3Client({
    region: "us-east-1",
    endpoint: env.storageEndpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
});

afterAll(async () => {
  await env?.stop();
});

/** Registers a new user and returns the access token. */
async function signUp(): Promise<string> {
  const res = await request(env.app.server).post("/users").send({
    name: "Jane Doe",
    email: `user-${randomUUID()}@example.com`,
    password: "password123",
  });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

/** Uploads a single part to its presigned URL and returns the ETag. */
async function putPart(url: string, body: Buffer): Promise<string> {
  const response = await fetch(url, { method: "PUT", body });
  expect(response.status).toBe(200);
  const etag = response.headers.get("etag");
  expect(etag).toBeTruthy();
  return etag as string;
}

/** Reads the stored object back as a Buffer. */
async function getObject(key: string): Promise<Buffer> {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: env.bucket, Key: key }),
  );
  const bytes = await (result.Body as {
    transformToByteArray: () => Promise<Uint8Array>;
  }).transformToByteArray();
  return Buffer.from(bytes);
}

describe("Authentication on files routes", () => {
  it("rejects POST /uploads without a token (401)", async () => {
    const res = await request(env.app.server).post("/uploads").send({
      folderId: randomUUID(),
      fileName: "a.txt",
      contentType: "text/plain",
      size: 10,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHENTICATED");
  });

  it("rejects a malformed token (401)", async () => {
    const res = await request(env.app.server)
      .post("/uploads")
      .set("Authorization", "Bearer not-a-jwt")
      .send({
        folderId: randomUUID(),
        fileName: "a.txt",
        contentType: "text/plain",
        size: 10,
      });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHENTICATED");
  });
});

describe("Multipart upload (start -> PUT -> complete)", () => {
  it("uploads a file in a single part", async () => {
    const token = await signUp();
    const content = Buffer.from("end-to-end file content");

    const start = await request(env.app.server)
      .post("/uploads")
      .set("Authorization", `Bearer ${token}`)
      .send({
        folderId: randomUUID(),
        fileName: "hello.txt",
        contentType: "text/plain",
        size: content.length,
      });
    expect(start.status).toBe(201);
    expect(start.body.parts).toHaveLength(1);

    const etag = await putPart(start.body.parts[0].url, content);

    const complete = await request(env.app.server)
      .post(`/uploads/${start.body.uploadId}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({ parts: [{ partNumber: 1, etag }] });
    expect(complete.status).toBe(200);
    expect(complete.body.fileId).toBeTruthy();
    expect(complete.body.key).toBe(start.body.key);

    const stored = await getObject(complete.body.key);
    expect(stored.equals(content)).toBe(true);

    const file = await env.prisma.fileMetadata.findUnique({
      where: { id: complete.body.fileId },
    });
    expect(file).not.toBeNull();
    expect(file?.storageKey).toBe(complete.body.key);
    expect(file?.name).toBe("hello.txt");
  });

  it("uploads a file split into multiple parts", async () => {
    const token = await signUp();
    const partSize = 5 * 1024 * 1024;
    const content = randomBytes(partSize + 1024);

    const start = await request(env.app.server)
      .post("/uploads")
      .set("Authorization", `Bearer ${token}`)
      .send({
        folderId: randomUUID(),
        fileName: "big.bin",
        contentType: "application/octet-stream",
        size: content.length,
        partSize,
      });
    expect(start.status).toBe(201);
    expect(start.body.parts.length).toBeGreaterThanOrEqual(2);

    const parts: { partNumber: number; etag: string }[] = [];
    for (const part of start.body.parts as {
      partNumber: number;
      url: string;
    }[]) {
      const from = (part.partNumber - 1) * start.body.partSize;
      const chunk = content.subarray(from, from + start.body.partSize);
      parts.push({
        partNumber: part.partNumber,
        etag: await putPart(part.url, chunk),
      });
    }

    const complete = await request(env.app.server)
      .post(`/uploads/${start.body.uploadId}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({ parts });
    expect(complete.status).toBe(200);

    const stored = await getObject(complete.body.key);
    expect(stored.equals(content)).toBe(true);
  });

  it("is idempotent: a second complete returns 409", async () => {
    const token = await signUp();
    const content = Buffer.from("idempotency check");

    const start = await request(env.app.server)
      .post("/uploads")
      .set("Authorization", `Bearer ${token}`)
      .send({
        folderId: randomUUID(),
        fileName: "once.txt",
        contentType: "text/plain",
        size: content.length,
      });
    const etag = await putPart(start.body.parts[0].url, content);
    const body = { parts: [{ partNumber: 1, etag }] };

    const first = await request(env.app.server)
      .post(`/uploads/${start.body.uploadId}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(first.status).toBe(200);

    const second = await request(env.app.server)
      .post(`/uploads/${start.body.uploadId}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("UPLOAD_NOT_PENDING");
  });

  it("forbids completing an upload owned by another user (403)", async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const content = Buffer.from("owner's file");

    const start = await request(env.app.server)
      .post("/uploads")
      .set("Authorization", `Bearer ${owner}`)
      .send({
        folderId: randomUUID(),
        fileName: "owned.txt",
        contentType: "text/plain",
        size: content.length,
      });
    const etag = await putPart(start.body.parts[0].url, content);

    const res = await request(env.app.server)
      .post(`/uploads/${start.body.uploadId}/complete`)
      .set("Authorization", `Bearer ${intruder}`)
      .send({ parts: [{ partNumber: 1, etag }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("UPLOAD_NOT_OWNED");
  });
});
