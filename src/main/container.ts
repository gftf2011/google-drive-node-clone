import { CreateRootFolderOnUserCreated } from "../drive/application/event-handlers/create-root-folder-on-user-created";
import { FileCreated } from "../drive/domain/events/file-created.event";
import { CompleteMultipartUpload } from "../drive/application/use-cases/complete-multipart-upload.use-case";
import { CreateFolder } from "../drive/application/use-cases/create-folder.use-case";
import { CreateRootFolder } from "../drive/application/use-cases/create-root-folder.use-case";
import { DeleteFolder } from "../drive/application/use-cases/delete-folder.use-case";
import { GetFileDownloadUrl } from "../drive/application/use-cases/get-file-download-url.use-case";
import { ListFolderContents } from "../drive/application/use-cases/list-folder-contents.use-case";
import { StartMultipartUpload } from "../drive/application/use-cases/start-multipart-upload.use-case";
import { PrismaFileMetadataRepository } from "../drive/infra/persistence/prisma-file-metadata-repository";
import { PrismaFolderRepository } from "../drive/infra/persistence/prisma-folder-repository";
import { PrismaUploadRepository } from "../drive/infra/persistence/prisma-upload-repository";
import { S3ObjectStorage } from "../drive/infra/storage/s3-object-storage";
import { CompleteMultipartUploadController } from "../drive/presentation/controllers/complete-multipart-upload.controller";
import { CreateFolderController } from "../drive/presentation/controllers/create-folder.controller";
import { DeleteFolderController } from "../drive/presentation/controllers/delete-folder.controller";
import { GetFileDownloadUrlController } from "../drive/presentation/controllers/get-file-download-url.controller";
import { ListFolderContentsController } from "../drive/presentation/controllers/list-folder-contents.controller";
import { StartMultipartUploadController } from "../drive/presentation/controllers/start-multipart-upload.controller";
import type { FileControllers } from "../drive/presentation/routes/file.routes";
import type { FolderControllers } from "../drive/presentation/routes/folder.routes";
import type { UploadControllers } from "../drive/presentation/routes/upload.routes";
import { EnqueueIngestionOnFileCreated } from "../rag/application/event-handlers/enqueue-ingestion-on-file-created";
import { EnqueueDocumentIngestion } from "../rag/application/use-cases/enqueue-document-ingestion.use-case";
import { PrismaRagDocumentRepository } from "../rag/infra/persistence/prisma-rag-document-repository";
import { TransactionalUseCase } from "../shared/application/transactional-use-case";
import { prisma } from "../shared/infra/database/prisma/client";
import { PrismaTransactionContext } from "../shared/infra/database/prisma/prisma-transaction-context";
import { InProcessEventDispatcher } from "../shared/infra/events/in-process-event-dispatcher";
import { SignIn } from "../users/application/use-cases/sign-in.use-case";
import { SignUp } from "../users/application/use-cases/sign-up.use-case";
import { UserCreated } from "../users/domain/events/user-created.event";
import { PrismaUserRepository } from "../users/infra/persistence/prisma-user-repository";
import { JwtTokenGenerator } from "../users/infra/providers/jwt-token-generator";
import { JwtTokenVerifier } from "../users/infra/providers/jwt-token-verifier";
import { SignInController } from "../users/presentation/controllers/sign-in.controller";
import { SignUpController } from "../users/presentation/controllers/sign-up.controller";
import { AuthenticateMiddleware } from "../users/presentation/middlewares/authenticate.middleware";
import type { UserControllers } from "../users/presentation/routes/user.routes";

import type { Env } from "./config/env";

export interface Container {
  userControllers: UserControllers;
  folderControllers: FolderControllers;
  uploadControllers: UploadControllers;
  fileControllers: FileControllers;
  /** Middleware de autenticação (do `users`), montado pelo `main` nas rotas protegidas. */
  authenticate: AuthenticateMiddleware;
  /**
   * Adapter de storage exposto para o bootstrap do bucket em dev (o `main` chama
   * `ensureBucketExists`). Em produção o bucket é provisionado por infra.
   */
  storage: S3ObjectStorage;
}

/**
 * Composition root: instancia os adapters, injeta as dependências e registra os
 * handlers de eventos entre contextos. É o ÚNICO lugar que conhece todos os
 * contextos ao mesmo tempo. Trocar a implementação de qualquer adapter (ex.: o
 * repositório) afeta apenas este arquivo — o domínio e a aplicação não mudam.
 */
export function buildContainer(env: Env): Container {
  // --- Transação/UoW: o mesmo contexto provê o client corrente aos repos e a
  // fronteira transacional (via AsyncLocalStorage). ---
  const unitOfWork = new PrismaTransactionContext(prisma);

  // --- Adapters de saída (infra) ---
  const userRepository = new PrismaUserRepository(unitOfWork);
  const folderRepository = new PrismaFolderRepository(unitOfWork);
  const uploadRepository = new PrismaUploadRepository(unitOfWork);
  const fileMetadataRepository = new PrismaFileMetadataRepository(unitOfWork);
  const ragDocumentRepository = new PrismaRagDocumentRepository(unitOfWork);
  const tokenGenerator = new JwtTokenGenerator({
    secret: env.jwt.secret,
    expiresInSeconds: env.jwt.expiresInSeconds,
  });
  const tokenVerifier = new JwtTokenVerifier({ secret: env.jwt.secret });
  const storage = new S3ObjectStorage({
    region: env.storage.region,
    bucket: env.storage.bucket,
    endpoint: env.storage.endpoint,
    accessKeyId: env.storage.accessKeyId,
    secretAccessKey: env.storage.secretAccessKey,
    forcePathStyle: env.storage.forcePathStyle,
  });

  // --- Eventos: dispatcher síncrono + fiação cross-context ---
  const eventPublisher = new InProcessEventDispatcher();
  // users -> drive: cria a pasta raiz ao cadastrar um usuário.
  eventPublisher.register(
    UserCreated.EVENT_NAME,
    new CreateRootFolderOnUserCreated(new CreateRootFolder(folderRepository)),
  );
  // drive -> rag: enfileira a ingestão do documento ao criar um arquivo. O
  // handler só insere a linha `pending` (barato) — a extração fica para o worker.
  eventPublisher.register(
    FileCreated.EVENT_NAME,
    new EnqueueIngestionOnFileCreated(
      new EnqueueDocumentIngestion(ragDocumentRepository),
    ),
  );

  // --- Casos de uso ---
  // SignUp muta estado (usuário + pasta raiz via evento) → decorado com a UoW,
  // para commitar tudo atomicamente. SignIn é somente leitura → sem transação.
  const signUp = new TransactionalUseCase(
    new SignUp(userRepository, eventPublisher, tokenGenerator),
    unitOfWork,
  );
  const signIn = new SignIn(userRepository, tokenGenerator);

  // Casos de uso de multipart upload — cada um é uma única escrita atômica,
  // então não precisam da UoW; envolvê-los manteria uma transação de banco
  // aberta durante as chamadas de rede ao storage.
  const startUpload = new StartMultipartUpload(
    uploadRepository,
    fileMetadataRepository,
    storage,
    env.storage.presignExpiresInSeconds,
    env.storage.userQuotaBytes,
  );
  // O `complete` grava duas vezes (upload concluído + arquivo criado); ele mesmo
  // abre a transação (via UoW) após a conclusão no storage, então não é decorado.
  const completeUpload = new CompleteMultipartUpload(
    uploadRepository,
    fileMetadataRepository,
    storage,
    unitOfWork,
    eventPublisher,
  );
  // Download — somente leitura, devolve uma URL pré-assinada de GET.
  const getFileDownloadUrl = new GetFileDownloadUrl(
    fileMetadataRepository,
    storage,
    env.storage.presignExpiresInSeconds,
  );

  // Criação de pasta — escrita única, sem UoW.
  const createFolder = new CreateFolder(folderRepository);
  // Remoção de pasta — apaga a subárvore (pastas + arquivos) na mesma transação
  // e limpa o storage em lote após o commit (best-effort).
  const deleteFolder = new DeleteFolder(
    folderRepository,
    fileMetadataRepository,
    storage,
    unitOfWork,
  );
  // Listagem de conteúdo — subpastas + arquivos num único caso de uso.
  const listFolderContents = new ListFolderContents(
    folderRepository,
    fileMetadataRepository,
  );

  // --- Controllers (presentation) ---
  return {
    userControllers: {
      signUp: new SignUpController(signUp),
      signIn: new SignInController(signIn),
    },
    folderControllers: {
      create: new CreateFolderController(createFolder),
      delete: new DeleteFolderController(deleteFolder),
      listContents: new ListFolderContentsController(listFolderContents),
    },
    uploadControllers: {
      start: new StartMultipartUploadController(startUpload),
      complete: new CompleteMultipartUploadController(completeUpload),
    },
    fileControllers: {
      getDownloadUrl: new GetFileDownloadUrlController(getFileDownloadUrl),
    },
    authenticate: new AuthenticateMiddleware(tokenVerifier),
    storage,
  };
}
