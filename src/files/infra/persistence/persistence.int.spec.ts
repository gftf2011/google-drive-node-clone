import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../shared/infra/database/prisma/generated/client";
import { PrismaTransactionContext } from "../../../shared/infra/database/prisma/prisma-transaction-context";
import { startPostgres } from "../../../shared/testing/containers";
import type { StartedPostgres } from "../../../shared/testing/containers";
import { FileMetadata } from "../../domain/aggregates/file-metadata";
import { Upload } from "../../domain/aggregates/upload";

import { PrismaFileMetadataRepository } from "./prisma-file-metadata-repository";
import { PrismaUploadRepository } from "./prisma-upload-repository";

const ownerId = "11111111-1111-1111-1111-111111111111";
const folderId = "22222222-2222-2222-2222-222222222222";

let postgres: StartedPostgres;
let prisma: PrismaClient;
let closeDatabase: () => Promise<void>;
let uploads: PrismaUploadRepository;
let files: PrismaFileMetadataRepository;

beforeAll(async () => {
  postgres = await startPostgres();
  const client = await import(
    "../../../shared/infra/database/prisma/client"
  );
  prisma = client.prisma;
  closeDatabase = client.closeDatabase;

  const context = new PrismaTransactionContext(prisma);
  uploads = new PrismaUploadRepository(context);
  files = new PrismaFileMetadataRepository(context);
});

afterAll(async () => {
  await closeDatabase?.();
  await postgres?.container.stop();
});

describe("PrismaUploadRepository", () => {
  it("saves an upload and reads it back with the same state", async () => {
    const upload = Upload.open({
      ownerId,
      folderId,
      fileName: "video.mp4",
      contentType: "video/mp4",
      size: 9000,
    });
    upload.attachStorageUpload("s3-upload-id");

    await uploads.save(upload);
    const found = await uploads.findById(upload.id.value);

    expect(found).not.toBeNull();
    expect(found?.id.value).toBe(upload.id.value);
    expect(found?.status).toBe("pending");
    expect(found?.storageUploadId).toBe("s3-upload-id");
    expect(found?.size.bytes).toBe(9000);
  });

  it("returns null when the upload does not exist", async () => {
    expect(await uploads.findById(randomUUID())).toBeNull();
  });

  it("upserts status changes on save", async () => {
    const upload = Upload.open({
      ownerId,
      folderId,
      fileName: "a.txt",
      contentType: "text/plain",
      size: 10,
    });
    upload.attachStorageUpload("s3-id");
    await uploads.save(upload);

    upload.complete();
    await uploads.save(upload);

    expect((await uploads.findById(upload.id.value))?.status).toBe("completed");
  });
});

describe("PrismaFileMetadataRepository", () => {
  it("persists a file metadata row", async () => {
    const file = FileMetadata.create({
      ownerId,
      folderId,
      name: "photo.jpg",
      contentType: "image/jpeg",
      size: 4096,
      storageKey: `uploads/${ownerId}/${randomUUID()}/photo.jpg`,
    });

    await files.save(file);

    const row = await prisma.fileMetadata.findUnique({
      where: { id: file.id.value },
    });
    expect(row).not.toBeNull();
    expect(row?.name).toBe("photo.jpg");
    expect(row?.folderId).toBe(folderId);
    expect(Number(row?.size)).toBe(4096);
  });
});
