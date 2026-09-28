import { randomUUID } from "node:crypto";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { startFloci } from "../../../shared/testing/containers";
import type { StartedFloci } from "../../../shared/testing/containers";

import { S3ObjectStorage } from "./s3-object-storage";

const BUCKET = "gdrive-uploads-test";

let floci: StartedFloci;
let storage: S3ObjectStorage;
let verifier: S3Client;

beforeAll(async () => {
  floci = await startFloci();
  const options = {
    region: "us-east-1",
    bucket: BUCKET,
    endpoint: floci.endpoint,
    accessKeyId: "test",
    secretAccessKey: "test",
    forcePathStyle: true,
  };
  storage = new S3ObjectStorage(options);
  await storage.ensureBucketExists();
  verifier = new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  });
});

afterAll(async () => {
  await floci?.container.stop();
});

describe("S3ObjectStorage against floci", () => {
  it("runs a full multipart cycle: create, presign, PUT, complete", async () => {
    const key = `uploads/test/${randomUUID()}/a.txt`;
    const content = Buffer.from("integration content through a presigned url");

    const storageUploadId = await storage.createMultipartUpload({
      key,
      contentType: "text/plain",
    });
    expect(storageUploadId).toBeTruthy();

    const url = await storage.presignUploadPart({
      key,
      storageUploadId,
      partNumber: 1,
      expiresInSeconds: 900,
    });
    expect(url).toContain("X-Amz-Signature");

    const put = await fetch(url, { method: "PUT", body: content });
    expect(put.status).toBe(200);
    const etag = put.headers.get("etag");
    expect(etag).toBeTruthy();

    const completed = await storage.completeMultipartUpload({
      key,
      storageUploadId,
      parts: [{ partNumber: 1, etag: etag as string }],
    });
    expect(completed.etag).toBeTruthy();

    const object = await verifier.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    const stored = Buffer.from(
      await (object.Body as {
        transformToByteArray: () => Promise<Uint8Array>;
      }).transformToByteArray(),
    );
    expect(stored.equals(content)).toBe(true);

    // A presigned download URL returns the content as an attachment.
    const downloadUrl = await storage.presignDownload({
      key,
      fileName: "a.txt",
      contentType: "text/plain",
      expiresInSeconds: 900,
    });
    const downloaded = await fetch(downloadUrl);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-disposition")).toContain(
      'attachment; filename="a.txt"',
    );
    expect(Buffer.from(await downloaded.arrayBuffer()).equals(content)).toBe(
      true,
    );

    // Batch delete removes the object.
    await storage.deleteObjects({ keys: [key] });
    await expect(
      verifier.send(new GetObjectCommand({ Bucket: BUCKET, Key: key })),
    ).rejects.toThrow();
  });

  it("batch-deletes many objects, tolerating missing keys", async () => {
    const keys: string[] = [];
    for (let i = 0; i < 3; i++) {
      const key = `uploads/test/${randomUUID()}/f${i}.txt`;
      const uploadId = await storage.createMultipartUpload({
        key,
        contentType: "text/plain",
      });
      const url = await storage.presignUploadPart({
        key,
        storageUploadId: uploadId,
        partNumber: 1,
        expiresInSeconds: 900,
      });
      const put = await fetch(url, { method: "PUT", body: Buffer.from(`x${i}`) });
      await storage.completeMultipartUpload({
        key,
        storageUploadId: uploadId,
        parts: [{ partNumber: 1, etag: put.headers.get("etag") as string }],
      });
      keys.push(key);
    }

    // Include a non-existent key — DeleteObjects is idempotent and must not throw.
    await storage.deleteObjects({
      keys: [...keys, `uploads/test/${randomUUID()}/missing.txt`],
    });

    for (const key of keys) {
      await expect(
        verifier.send(new GetObjectCommand({ Bucket: BUCKET, Key: key })),
      ).rejects.toThrow();
    }
  });
});
