# google-drive-node-clone

Clone das funcionalidades do Google Drive em **Node.js** com **TypeScript**, **Fastify** e **Prisma ORM**, seguindo **Clean Architecture** e **DDD**.

## Stack

- **Node.js 24 LTS** (Krypton) — versão fixada em `.nvmrc`
- **TypeScript 7** com ESM (executado via **tsx**; `tsc` só para checagem de tipos)
- **Fastify 5** na borda HTTP
- **Prisma ORM 7** com driver adapter para PostgreSQL (`@prisma/adapter-pg`)
- **AWS SDK v3 (S3)** para armazenamento de objetos; **floci** como simulador da AWS em dev
- **Jest + supertest + testcontainers** para testes (unit, integração e e2e)

## Arquitetura

Clean Architecture + DDD, com dois **bounded contexts**:

- **`users`** — identidade e autenticação (cadastro, login, JWT).
- **`drive`** — a árvore do Drive: **pastas**, **arquivos** (`FileMetadata`) e **uploads** (sessão de multipart). Pasta e arquivo vivem no mesmo contexto, então a listagem e a deleção em cascata acontecem sem cruzar fronteiras.

Cada contexto é organizado em camadas: `domain` (agregados, value objects, erros, contratos de repositório), `application` (casos de uso e ports), `infra` (Prisma, S3) e `presentation` (controllers e rotas Fastify). A dependência aponta sempre para dentro; o `main` é o **composition root** — o único lugar que conhece todos os contextos.

O envio e o download dos bytes não passam pela aplicação: o backend gera **URLs pré-assinadas** e o cliente fala direto com o storage.

## Pré-requisitos

- Node.js 24+ (`nvm use` para usar a versão do `.nvmrc`)
- Docker (para subir PostgreSQL + floci via `docker-compose`)

## Configuração

```bash
# 1. Instalar dependências
npm install

# 2. Subir PostgreSQL + floci (simulador S3/AWS)
docker compose up -d

# 3. Criar o .env a partir do exemplo (já combina com o docker-compose)
cp .env.example .env

# 4. Gerar o Prisma Client
npm run prisma:generate

# 5. Aplicar as migrations
npm run prisma:migrate:deploy

# 6. Rodar em desenvolvimento
npm run dev
```

O bucket de uploads é criado automaticamente no floci ao subir o servidor em dev.

## Scripts

| Comando                         | Descrição                                          |
| ------------------------------- | -------------------------------------------------- |
| `npm run dev`                   | Sobe o servidor com hot-reload (`tsx watch`)       |
| `npm start`                     | Sobe o servidor (`tsx`)                            |
| `npm run typecheck`             | Checagem de tipos (produção + testes), sem emitir  |
| `npm run prisma:generate`       | Gera o Prisma Client                               |
| `npm run prisma:migrate`        | Cria/aplica migrations em desenvolvimento          |
| `npm run prisma:migrate:deploy` | Aplica migrations pendentes (produção/CI)          |
| `npm run prisma:studio`         | Abre o Prisma Studio                               |
| `npm test`                      | Toda a suíte (unit + integração + e2e)             |
| `npm run test:unit`             | Apenas testes de unidade (sem containers)          |
| `npm run test:integration`      | Testes de integração (Postgres + floci)            |
| `npm run test:e2e`              | Testes e2e das rotas (Postgres + floci)            |

Os testes de integração e e2e sobem containers efêmeros via testcontainers (exigem Docker) e aplicam as migrations automaticamente.

## API

Autenticação por `Authorization: Bearer <token>`. O token vem de `POST /users` ou `POST /sessions`.

| Método   | Rota                          | Auth | Descrição                                              |
| -------- | ----------------------------- | :--: | ------------------------------------------------------ |
| `POST`   | `/users`                      |  —   | Cadastro; retorna `{ token }`                          |
| `POST`   | `/sessions`                   |  —   | Login; retorna `{ token }`                             |
| `POST`   | `/uploads`                    |  ✓   | Inicia multipart; retorna `{ uploadId, partSize, parts[] }` |
| `POST`   | `/uploads/:uploadId/complete` |  ✓   | Conclui o upload e cria o arquivo; retorna `{ fileId, key }` |
| `GET`    | `/files/:fileId/download-url` |  ✓   | URL pré-assinada de download                           |
| `POST`   | `/folders`                    |  ✓   | Cria uma pasta (`parentId` opcional = raiz)            |
| `GET`    | `/folders`                    |  ✓   | Lista o conteúdo da raiz (`?sort=recent\|name`)         |
| `GET`    | `/folders/:folderId`          |  ✓   | Lista o conteúdo da pasta (`?sort=recent\|name`)        |
| `DELETE` | `/folders/:folderId`          |  ✓   | Deleta a pasta e toda a subárvore (pastas + arquivos)  |
| `GET`    | `/health`                     |  —   | Healthcheck                                            |

Fluxo de upload: `POST /uploads` → o cliente faz `PUT` de cada parte nas URLs pré-assinadas → `POST /uploads/:id/complete` com as ETags.

## Estrutura

```
.
├── prisma/
│   ├── schema.prisma            # Modelos e datasource
│   └── migrations/              # Migrations versionadas
├── src/
│   ├── users/                   # Contexto: identidade e autenticação
│   │   ├── domain/              #   agregados, value objects, erros, repositórios
│   │   ├── application/         #   casos de uso e ports (ex.: token generator/verifier)
│   │   ├── infra/               #   Prisma, provedores (JWT)
│   │   └── presentation/        #   controllers, rotas, middleware de auth
│   ├── drive/                   # Contexto: pastas + arquivos + uploads
│   │   ├── domain/
│   │   ├── application/         #   casos de uso, ports (ObjectStorage), event-handlers
│   │   ├── infra/               #   Prisma (repos), S3 (adapter)
│   │   └── presentation/
│   ├── shared/                  # Kernel compartilhado
│   │   ├── domain/              #   AggregateRoot, DomainEvent, Uuid, DomainError
│   │   ├── application/         #   UseCase, UnitOfWork, DomainEventPublisher, ListSort
│   │   ├── infra/               #   Prisma client, dispatcher de eventos
│   │   └── testing/             #   helpers de testcontainers (Postgres/floci) e app e2e
│   └── main/                    # Composition root
│       ├── config/              #   carregamento de env
│       ├── container.ts         #   injeção de dependências
│       └── http/                #   montagem do Fastify + rotas
├── docker-compose.yml           # PostgreSQL + floci
├── prisma7.config.ts            # Configuração do Prisma (carrega .env)
├── jest.config.mjs              # Projetos jest: unit / integration / e2e
└── tsconfig.json
```
