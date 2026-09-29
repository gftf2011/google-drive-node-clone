# google-drive-node-clone

A clone of Google Drive's core features in **Node.js** with **TypeScript**, **Fastify** and **Prisma ORM**, following **Clean Architecture** and **DDD**.

## Stack

- **Node.js 24 LTS** (Krypton) — version pinned in `.nvmrc`
- **TypeScript 7** with ESM (run via **tsx**; `tsc` is used only for type checking)
- **Fastify 5** at the HTTP edge
- **Prisma ORM 7** with a driver adapter for PostgreSQL (`@prisma/adapter-pg`)
- **AWS SDK v3 (S3)** for object storage; **floci** as the AWS simulator in dev
- **Jest + supertest + testcontainers** for tests (unit, integration and e2e)

## Architecture

Clean Architecture + DDD, with two **bounded contexts**:

- **`users`** — identity and authentication (sign up, sign in, JWT).
- **`drive`** — the Drive tree: **folders**, **files** (`FileMetadata`) and **uploads** (the multipart session). Folder and file live in the same context, so listing and cascading deletion happen without crossing boundaries.

Each context is organized in layers: `domain` (aggregates, value objects, errors, repository contracts), `application` (use cases and ports), `infra` (Prisma, S3) and `presentation` (Fastify controllers and routes). Dependencies always point inward; `main` is the **composition root** — the only place that knows every context.

Uploading and downloading bytes never go through the application: the backend issues **presigned URLs** and the client talks to the storage directly.

## Scope & simplifications

This project focuses on the storage domain (accounts, the folder/file tree, uploads and downloads). To keep it simple, **client synchronization was intentionally left out** — there is no real-time or offline sync between devices (no change feed, delta/cursor API, conflict resolution, or push channel). Clients read the current state on demand via the listing endpoints. Other deliberate simplifications: no background job pipeline (folder deletion and its storage cleanup run synchronously) and a per-user storage quota enforced at upload start only.

## Prerequisites

- Node.js 24+ (`nvm use` to match `.nvmrc`)
- Docker (to run PostgreSQL + floci via `docker-compose`)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL + floci (S3/AWS simulator)
docker compose up -d

# 3. Create .env from the example (already matches docker-compose)
cp .env.example .env

# 4. Generate the Prisma Client
npm run prisma:generate

# 5. Apply the migrations
npm run prisma:migrate:deploy

# 6. Run in development
npm run dev
```

The uploads bucket is created automatically on floci when the dev server starts.

## Scripts

| Command                         | Description                                       |
| ------------------------------- | ------------------------------------------------- |
| `npm run dev`                   | Start the server with hot-reload (`tsx watch`)    |
| `npm start`                     | Start the server (`tsx`)                          |
| `npm run typecheck`             | Type-check (production + tests), no emit          |
| `npm run prisma:generate`       | Generate the Prisma Client                        |
| `npm run prisma:migrate`        | Create/apply migrations in development            |
| `npm run prisma:migrate:deploy` | Apply pending migrations (production/CI)          |
| `npm run prisma:studio`         | Open Prisma Studio                                |
| `npm test`                      | Full suite (unit + integration + e2e)             |
| `npm run test:unit`             | Unit tests only (no containers)                   |
| `npm run test:integration`      | Integration tests (Postgres + floci)              |
| `npm run test:e2e`              | Route e2e tests (Postgres + floci)                |

Integration and e2e tests spin up ephemeral containers via testcontainers (Docker required) and apply the migrations automatically. Load tests (k6) live in [`load/`](load/README.md).

## API

Authentication via `Authorization: Bearer <token>`. The token comes from `POST /users` or `POST /sessions`.

| Method   | Route                         | Auth | Description                                              |
| -------- | ----------------------------- | :--: | ------------------------------------------------------- |
| `POST`   | `/users`                      |  —   | Sign up; returns `{ token }`                            |
| `POST`   | `/sessions`                   |  —   | Sign in; returns `{ token }`                            |
| `POST`   | `/uploads`                    |  ✓   | Start a multipart upload; returns `{ uploadId, partSize, parts[] }` |
| `POST`   | `/uploads/:uploadId/complete` |  ✓   | Finish the upload and create the file; returns `{ fileId, key }` |
| `GET`    | `/files/:fileId/download-url` |  ✓   | Presigned download URL                                  |
| `POST`   | `/folders`                    |  ✓   | Create a folder (`parentId` optional = root)            |
| `GET`    | `/folders`                    |  ✓   | List the root contents (`?sort=recent\|name`)            |
| `GET`    | `/folders/:folderId`          |  ✓   | List the folder contents (`?sort=recent\|name`)          |
| `DELETE` | `/folders/:folderId`          |  ✓   | Delete the folder and its whole subtree (folders + files) |
| `GET`    | `/health`                     |  —   | Healthcheck                                             |

Upload flow: `POST /uploads` → the client `PUT`s each part to the presigned URLs → `POST /uploads/:id/complete` with the ETags. Each user has a storage quota (15 GiB by default); a start that would exceed it is rejected with `507`.

## Project layout

```
.
├── prisma/
│   ├── schema.prisma            # Models and datasource
│   └── migrations/              # Versioned migrations
├── src/
│   ├── users/                   # Context: identity and authentication
│   │   ├── domain/              #   aggregates, value objects, errors, repositories
│   │   ├── application/         #   use cases and ports (e.g. token generator/verifier)
│   │   ├── infra/               #   Prisma, providers (JWT)
│   │   └── presentation/        #   controllers, routes, auth middleware
│   ├── drive/                   # Context: folders + files + uploads
│   │   ├── domain/
│   │   ├── application/         #   use cases, ports (ObjectStorage), event handlers
│   │   ├── infra/               #   Prisma (repos), S3 (adapter)
│   │   └── presentation/
│   ├── shared/                  # Shared kernel
│   │   ├── domain/              #   AggregateRoot, DomainEvent, Uuid, DomainError
│   │   ├── application/         #   UseCase, UnitOfWork, DomainEventPublisher, ListSort
│   │   ├── infra/               #   Prisma client, event dispatcher
│   │   └── testing/             #   testcontainers helpers (Postgres/floci) and e2e app
│   └── main/                    # Composition root
│       ├── config/              #   env loading
│       ├── container.ts         #   dependency injection
│       └── http/                #   Fastify assembly + routes
├── load/                        # k6 load tests
├── docker-compose.yml           # PostgreSQL + floci
├── prisma7.config.ts            # Prisma config (loads .env)
├── jest.config.mjs              # jest projects: unit / integration / e2e
└── tsconfig.json
```
