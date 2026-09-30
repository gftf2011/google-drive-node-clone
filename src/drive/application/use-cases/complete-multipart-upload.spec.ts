import type { DomainEventPublisher } from "../../../shared/application/ports/domain-event-publisher";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { FileMetadata } from "../../domain/aggregates/file-metadata";
import { Upload } from "../../domain/aggregates/upload";
import { FileCreated } from "../../domain/events/file-created.event";
import { EmptyPartsError } from "../../domain/errors/empty-parts.error";
import { InvalidPartNumberError } from "../../domain/errors/invalid-part-number.error";
import { UploadNotFoundError } from "../../domain/errors/upload-not-found.error";
import { UploadNotOwnedError } from "../../domain/errors/upload-not-owned.error";
import { UploadNotPendingError } from "../../domain/errors/upload-not-pending.error";
import type { FileMetadataRepository } from "../../domain/repositories/file-metadata-repository";
import type { UploadRepository } from "../../domain/repositories/upload-repository";
import type { ObjectStorage } from "../ports/storage/object-storage";

import { CompleteMultipartUpload } from "./complete-multipart-upload.use-case";

const ownerId = "11111111-1111-1111-1111-111111111111";
const otherOwnerId = "99999999-9999-9999-9999-999999999999";
const folderId = "22222222-2222-2222-2222-222222222222";

function pendingUpload(): Upload {
  const upload = Upload.open({
    ownerId,
    folderId,
    fileName: "a.txt",
    contentType: "text/plain",
    size: 10,
  });
  upload.attachStorageUpload("s3-upload-id");
  return upload;
}

function makeStorage(): ObjectStorage {
  return {
    createMultipartUpload: jest.fn(),
    presignUploadPart: jest.fn(),
    completeMultipartUpload: jest
      .fn()
      .mockResolvedValue({ etag: "final-etag", location: "http://loc/a.txt" }),
    presignDownload: jest.fn(),
    deleteObjects: jest.fn(),
  };
}

function makeUploads(seed: Upload | null): UploadRepository {
  return {
    findById: jest.fn().mockResolvedValue(seed),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeFiles(): FileMetadataRepository & { saved: FileMetadata[] } {
  const saved: FileMetadata[] = [];
  return {
    saved,
    findById: jest.fn().mockResolvedValue(null),
    sumSizeByOwnerId: jest.fn().mockResolvedValue(0),
    save: jest.fn().mockImplementation(async (file: FileMetadata) => {
      saved.push(file);
    }),
    findByFolderId: jest.fn().mockResolvedValue([]),
    findByFolderIds: jest.fn().mockResolvedValue([]),
    deleteByFolderIds: jest.fn().mockResolvedValue(undefined),
  };
}

// Runs the transactional work inline, without a real database.
const unitOfWork: UnitOfWork = {
  runInTransaction: (work) => work(),
};

function makeEventPublisher(): DomainEventPublisher {
  return { publishAll: jest.fn().mockResolvedValue(undefined) };
}

// Shared no-op publisher for tests that don't assert on published events.
const eventPublisher = makeEventPublisher();

describe("CompleteMultipartUpload", () => {
  it("completes the storage object and creates the file metadata", async () => {
    const upload = pendingUpload();
    const uploads = makeUploads(upload);
    const files = makeFiles();
    const storage = makeStorage();
    const useCase = new CompleteMultipartUpload(
      uploads,
      files,
      storage,
      unitOfWork,
      eventPublisher,
    );

    const output = await useCase.execute({
      uploadId: upload.id.value,
      ownerId,
      parts: [{ partNumber: 1, etag: "etag-1" }],
    });

    expect(output.fileId).toBeTruthy();
    expect(output.etag).toBe("final-etag");
    expect(output.key).toBe(upload.storageKey.value);
    expect(upload.status).toBe("completed");
    expect(files.saved).toHaveLength(1);
    expect(files.saved[0]!.storageKey.value).toBe(upload.storageKey.value);
  });

  it("publishes a FileCreated event so ingestion is enqueued", async () => {
    const upload = pendingUpload();
    const publisher = makeEventPublisher();
    const useCase = new CompleteMultipartUpload(
      makeUploads(upload),
      makeFiles(),
      makeStorage(),
      unitOfWork,
      publisher,
    );

    const output = await useCase.execute({
      uploadId: upload.id.value,
      ownerId,
      parts: [{ partNumber: 1, etag: "etag-1" }],
    });

    expect(publisher.publishAll).toHaveBeenCalledTimes(1);
    const published = (publisher.publishAll as jest.Mock).mock.calls[0]![0] as
      | FileCreated[];
    expect(published).toHaveLength(1);
    const event = published[0]!;
    expect(event).toBeInstanceOf(FileCreated);
    expect(event.eventName).toBe(FileCreated.EVENT_NAME);
    expect(event.aggregateId).toBe(output.fileId);
    expect(event.ownerId).toBe(ownerId);
    expect(event.storageKey).toBe(upload.storageKey.value);
  });

  it("forwards the client-supplied contentHash on the FileCreated event", async () => {
    const upload = pendingUpload();
    const publisher = makeEventPublisher();
    const useCase = new CompleteMultipartUpload(
      makeUploads(upload),
      makeFiles(),
      makeStorage(),
      unitOfWork,
      publisher,
    );
    const contentHash = "b".repeat(64);

    await useCase.execute({
      uploadId: upload.id.value,
      ownerId,
      parts: [{ partNumber: 1, etag: "etag-1" }],
      contentHash,
    });

    const published = (publisher.publishAll as jest.Mock).mock
      .calls[0]![0] as FileCreated[];
    expect(published[0]!.contentHash).toBe(contentHash);
  });

  it("sorts the parts by number before completing on the storage", async () => {
    const upload = pendingUpload();
    const storage = makeStorage();
    const useCase = new CompleteMultipartUpload(
      makeUploads(upload),
      makeFiles(),
      storage,
      unitOfWork,
      eventPublisher,
    );

    await useCase.execute({
      uploadId: upload.id.value,
      ownerId,
      parts: [
        { partNumber: 2, etag: "etag-2" },
        { partNumber: 1, etag: "etag-1" },
      ],
    });

    expect(storage.completeMultipartUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        parts: [
          { partNumber: 1, etag: "etag-1" },
          { partNumber: 2, etag: "etag-2" },
        ],
      }),
    );
  });

  it("fails when the upload does not exist", async () => {
    const useCase = new CompleteMultipartUpload(
      makeUploads(null),
      makeFiles(),
      makeStorage(),
      unitOfWork,
      eventPublisher,
    );
    await expect(
      useCase.execute({
        uploadId: "44444444-4444-4444-4444-444444444444",
        ownerId,
        parts: [{ partNumber: 1, etag: "e" }],
      }),
    ).rejects.toBeInstanceOf(UploadNotFoundError);
  });

  it("fails when the upload belongs to another user", async () => {
    const upload = pendingUpload();
    const useCase = new CompleteMultipartUpload(
      makeUploads(upload),
      makeFiles(),
      makeStorage(),
      unitOfWork,
      eventPublisher,
    );
    await expect(
      useCase.execute({
        uploadId: upload.id.value,
        ownerId: otherOwnerId,
        parts: [{ partNumber: 1, etag: "e" }],
      }),
    ).rejects.toBeInstanceOf(UploadNotOwnedError);
  });

  it("fails when the upload is already completed", async () => {
    const upload = pendingUpload();
    upload.complete();
    const useCase = new CompleteMultipartUpload(
      makeUploads(upload),
      makeFiles(),
      makeStorage(),
      unitOfWork,
      eventPublisher,
    );
    await expect(
      useCase.execute({
        uploadId: upload.id.value,
        ownerId,
        parts: [{ partNumber: 1, etag: "e" }],
      }),
    ).rejects.toBeInstanceOf(UploadNotPendingError);
  });

  it("rejects an empty parts manifest", async () => {
    const upload = pendingUpload();
    const useCase = new CompleteMultipartUpload(
      makeUploads(upload),
      makeFiles(),
      makeStorage(),
      unitOfWork,
      eventPublisher,
    );
    await expect(
      useCase.execute({ uploadId: upload.id.value, ownerId, parts: [] }),
    ).rejects.toBeInstanceOf(EmptyPartsError);
  });

  it("rejects duplicate part numbers", async () => {
    const upload = pendingUpload();
    const useCase = new CompleteMultipartUpload(
      makeUploads(upload),
      makeFiles(),
      makeStorage(),
      unitOfWork,
      eventPublisher,
    );
    await expect(
      useCase.execute({
        uploadId: upload.id.value,
        ownerId,
        parts: [
          { partNumber: 1, etag: "a" },
          { partNumber: 1, etag: "b" },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidPartNumberError);
  });
});
