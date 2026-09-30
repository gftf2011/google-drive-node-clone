-- CreateTable
CREATE TABLE "rag_documents" (
    "file_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "content_hash" TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("file_id")
);

-- CreateIndex
CREATE INDEX "rag_documents_status_idx" ON "rag_documents"("status");

-- CreateIndex
CREATE INDEX "rag_documents_owner_id_idx" ON "rag_documents"("owner_id");

-- CreateIndex
CREATE INDEX "rag_documents_folder_id_idx" ON "rag_documents"("folder_id");

-- CreateIndex
CREATE INDEX "rag_documents_content_hash_idx" ON "rag_documents"("content_hash");
