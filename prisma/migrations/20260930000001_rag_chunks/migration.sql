-- Extensão pgvector: necessária para o tipo `vector` e o índice HNSW.
-- (Imagem do Postgres precisa trazer o pgvector — ver docker-compose.)
CREATE EXTENSION IF NOT EXISTS vector;

-- Chunks de um documento extraído. Tabela gerida por SQL CRU (o Prisma não
-- expressa o tipo `vector`/HNSW) e acessada pelo PgVectorChunkRepository.
-- `embedding` tem 384 dimensões (bge-small-en-v1.5); troque junto com o modelo.
CREATE TABLE "rag_chunks" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "heading_trail" TEXT[] NOT NULL DEFAULT '{}',
    "content" TEXT NOT NULL,
    "char_count" INTEGER NOT NULL,
    "page" INTEGER,
    "language" TEXT,
    -- Metadados DERIVADOS (enriquecimento por LLM).
    "summary" TEXT,
    "keywords" TEXT[] NOT NULL DEFAULT '{}',
    "hypothetical_questions" TEXT[] NOT NULL DEFAULT '{}',
    -- Cauda longa de metadados estruturais (ex.: text_as_html, coordenadas).
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(384),
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_chunks_pkey" PRIMARY KEY ("id")
);

-- Todos os chunks de um arquivo (reingestão apaga por aqui).
CREATE INDEX "rag_chunks_file_id_idx" ON "rag_chunks"("file_id");
-- Escopos de filtro/segurança da busca do RAG.
CREATE INDEX "rag_chunks_owner_id_idx" ON "rag_chunks"("owner_id");
CREATE INDEX "rag_chunks_folder_id_idx" ON "rag_chunks"("folder_id");
-- Consultas de contenção sobre os metadados abertos.
CREATE INDEX "rag_chunks_metadata_idx" ON "rag_chunks" USING gin ("metadata" jsonb_path_ops);
-- HNSW por cosseno — índice de vizinhos aproximados para a busca vetorial.
CREATE INDEX "rag_chunks_embedding_idx"
    ON "rag_chunks" USING hnsw ("embedding" vector_cosine_ops);
