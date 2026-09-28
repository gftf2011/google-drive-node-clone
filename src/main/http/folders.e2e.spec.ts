import { randomUUID } from "node:crypto";

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

/** Creates a folder and returns its id. */
async function createFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const res = await request(env.app.server)
    .post("/folders")
    .set("Authorization", `Bearer ${token}`)
    .send(parentId === undefined ? { name } : { name, parentId });
  expect(res.status).toBe(201);
  return res.body.folderId as string;
}

/** Uploads a small file into a folder and returns its metadata id and key. */
async function uploadFileInto(
  token: string,
  folderId: string,
): Promise<{ fileId: string; key: string }> {
  const content = Buffer.from("file inside a folder to be deleted");
  const start = await request(env.app.server)
    .post("/uploads")
    .set("Authorization", `Bearer ${token}`)
    .send({
      folderId,
      fileName: "doc.txt",
      contentType: "text/plain",
      size: content.length,
    });
  expect(start.status).toBe(201);

  const put = await fetch(start.body.parts[0].url, {
    method: "PUT",
    body: content,
  });
  expect(put.status).toBe(200);

  const complete = await request(env.app.server)
    .post(`/uploads/${start.body.uploadId}/complete`)
    .set("Authorization", `Bearer ${token}`)
    .send({ parts: [{ partNumber: 1, etag: put.headers.get("etag") }] });
  expect(complete.status).toBe(200);
  return { fileId: complete.body.fileId, key: complete.body.key };
}

/** Returns whether an object still exists in the storage. */
async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new GetObjectCommand({ Bucket: env.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

describe("Create folder", () => {
  it("rejects the request without a token (401)", async () => {
    const res = await request(env.app.server)
      .post("/folders")
      .send({ name: "Documents" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHENTICATED");
  });

  it("creates a folder under the user's root when no parent is given", async () => {
    const token = await signUp();

    const res = await request(env.app.server)
      .post("/folders")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Documents" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Documents");
    expect(res.body.folderId).toBeTruthy();
    expect(res.body.parentId).toBeTruthy();

    const row = await env.prisma.folder.findUnique({
      where: { id: res.body.folderId },
    });
    expect(row?.parentId).toBe(res.body.parentId);
  });

  it("creates a nested folder under an explicit parent", async () => {
    const token = await signUp();

    const parent = await request(env.app.server)
      .post("/folders")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Work" });

    const child = await request(env.app.server)
      .post("/folders")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Reports", parentId: parent.body.folderId });

    expect(child.status).toBe(201);
    expect(child.body.parentId).toBe(parent.body.folderId);
  });

  it("rejects an invalid folder name (400)", async () => {
    const token = await signUp();
    const res = await request(env.app.server)
      .post("/folders")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "  " });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_FOLDER_NAME");
  });

  it("fails when the parent does not exist (404)", async () => {
    const token = await signUp();
    const res = await request(env.app.server)
      .post("/folders")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Reports", parentId: randomUUID() });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("PARENT_FOLDER_NOT_FOUND");
  });

  it("forbids creating under another user's folder (403)", async () => {
    const ownerToken = await signUp();
    const owned = await request(env.app.server)
      .post("/folders")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Owner's folder" });

    const intruderToken = await signUp();
    const res = await request(env.app.server)
      .post("/folders")
      .set("Authorization", `Bearer ${intruderToken}`)
      .send({ name: "Sneaky", parentId: owned.body.folderId });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FOLDER_ACCESS_DENIED");
  });
});

describe("Delete folder", () => {
  it("rejects the request without a token (401)", async () => {
    const res = await request(env.app.server).delete(`/folders/${randomUUID()}`);
    expect(res.status).toBe(401);
  });

  it("deletes the folder with its whole subtree, files and storage objects", async () => {
    const token = await signUp();
    const parent = await createFolder(token, "Parent");
    const child = await createFolder(token, "Child", parent);
    const file = await uploadFileInto(token, child);

    // Everything is in place before deletion.
    expect(await objectExists(file.key)).toBe(true);
    expect(
      await env.prisma.fileMetadata.findUnique({ where: { id: file.fileId } }),
    ).not.toBeNull();

    const res = await request(env.app.server)
      .delete(`/folders/${parent}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    // Folders, file rows and storage object are all gone.
    expect(
      await env.prisma.folder.findUnique({ where: { id: parent } }),
    ).toBeNull();
    expect(
      await env.prisma.folder.findUnique({ where: { id: child } }),
    ).toBeNull();
    expect(
      await env.prisma.fileMetadata.findUnique({ where: { id: file.fileId } }),
    ).toBeNull();
    expect(await objectExists(file.key)).toBe(false);
  });

  it("refuses to delete the root folder (400)", async () => {
    const token = await signUp();
    // Creating a folder without a parent returns the root id as parentId.
    const create = await request(env.app.server)
      .post("/folders")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Anything" });
    const rootId = create.body.parentId as string;

    const res = await request(env.app.server)
      .delete(`/folders/${rootId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CANNOT_DELETE_ROOT_FOLDER");
  });

  it("fails when the folder does not exist (404)", async () => {
    const token = await signUp();
    const res = await request(env.app.server)
      .delete(`/folders/${randomUUID()}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("FOLDER_NOT_FOUND");
  });

  it("forbids deleting another user's folder (403)", async () => {
    const ownerToken = await signUp();
    const owned = await createFolder(ownerToken, "Owner's folder");

    const intruderToken = await signUp();
    const res = await request(env.app.server)
      .delete(`/folders/${owned}`)
      .set("Authorization", `Bearer ${intruderToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FOLDER_ACCESS_DENIED");
  });
});

describe("List folder contents", () => {
  it("rejects the request without a token (401)", async () => {
    const res = await request(env.app.server).get("/folders");
    expect(res.status).toBe(401);
  });

  it("returns both subfolders and files of the root", async () => {
    const token = await signUp();

    // Discover the root id, then put a folder and a file directly in it.
    const rootListing = await request(env.app.server)
      .get("/folders")
      .set("Authorization", `Bearer ${token}`);
    const rootId = rootListing.body.folderId as string;

    await createFolder(token, "Sub");
    await uploadFileInto(token, rootId);

    const res = await request(env.app.server)
      .get("/folders")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.folderId).toBe(rootId);
    expect(res.body.folders.map((f: { name: string }) => f.name)).toContain(
      "Sub",
    );
    expect(res.body.files.map((f: { name: string }) => f.name)).toContain(
      "doc.txt",
    );
  });

  it("orders subfolders by most recent first with sort=recent", async () => {
    const token = await signUp();
    await createFolder(token, "Older");
    await createFolder(token, "Newer");

    const res = await request(env.app.server)
      .get("/folders?sort=recent")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = res.body.folders.map((f: { name: string }) => f.name);
    expect(names.indexOf("Newer")).toBeLessThan(names.indexOf("Older"));
  });

  it("lists the contents of a specific folder", async () => {
    const token = await signUp();
    const parent = await createFolder(token, "Parent");
    await createFolder(token, "Child", parent);
    await uploadFileInto(token, parent);

    const res = await request(env.app.server)
      .get(`/folders/${parent}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.folderId).toBe(parent);
    expect(res.body.folders.map((f: { name: string }) => f.name)).toEqual([
      "Child",
    ]);
    expect(res.body.files.map((f: { name: string }) => f.name)).toEqual([
      "doc.txt",
    ]);
  });

  it("fails for a non-existent folder (404)", async () => {
    const token = await signUp();
    const res = await request(env.app.server)
      .get(`/folders/${randomUUID()}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("FOLDER_NOT_FOUND");
  });

  it("forbids listing another user's folder (403)", async () => {
    const ownerToken = await signUp();
    const owned = await createFolder(ownerToken, "Owner's folder");

    const intruderToken = await signUp();
    const res = await request(env.app.server)
      .get(`/folders/${owned}`)
      .set("Authorization", `Bearer ${intruderToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FOLDER_ACCESS_DENIED");
  });
});
