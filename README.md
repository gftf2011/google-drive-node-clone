# google-drive-node-clone

Clone das funcionalidades do Google Drive em **Node.js** com **TypeScript** e **Prisma ORM**.

## Stack

- **Node.js 24 LTS** (Krypton) — versão fixada em `.nvmrc`
- **TypeScript 7** com módulos ESM (`nodenext`)
- **Prisma ORM 7** com driver adapter para PostgreSQL (`@prisma/adapter-pg`)
- **tsx** para execução/hot-reload em desenvolvimento

## Pré-requisitos

- Node.js 24+ (`nvm use` para usar a versão do `.nvmrc`)
- Uma instância de PostgreSQL acessível

## Configuração

```bash
# 1. Instalar dependências
npm install

# 2. Criar o .env a partir do exemplo e ajustar a DATABASE_URL
cp .env.example .env

# 3. Gerar o Prisma Client
npm run prisma:generate

# 4. Aplicar as migrações (após definir modelos em prisma/schema.prisma)
npm run prisma:migrate
```

## Scripts

| Comando                  | Descrição                                        |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Executa `src/index.ts` com hot-reload (tsx)      |
| `npm run build`          | Compila TypeScript para `dist/`                  |
| `npm start`              | Executa a build de produção (`dist/index.js`)    |
| `npm run typecheck`      | Checagem de tipos sem emitir arquivos            |
| `npm run prisma:generate`| Gera o Prisma Client                             |
| `npm run prisma:migrate` | Cria/aplica migrações em desenvolvimento         |
| `npm run prisma:migrate:deploy` | Aplica migrações pendentes (produção/CI)  |
| `npm run prisma:studio`  | Abre o Prisma Studio                             |
| `npm test`               | Testes (unit + e2e com testcontainers)           |

## Estrutura

```
.
├── prisma/
│   └── schema.prisma        # Modelos e datasource
├── src/
│   ├── shared/infra/database/prisma/
│   │   ├── generated/       # Prisma Client gerado (não versionado)
│   │   └── client.ts        # Singleton do PrismaClient (infra)
│   └── index.ts             # Ponto de entrada (composition root)
├── prisma7.config.ts        # Configuração do Prisma (carrega .env)
└── tsconfig.json
```
