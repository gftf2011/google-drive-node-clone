import { PurgeFilesOnFolderDeleted } from "../files/application/event-handlers/purge-files-on-folder-deleted";
import { CompleteMultipartUpload } from "../files/application/use-cases/complete-multipart-upload.use-case";
import { GetFileDownloadUrl } from "../files/application/use-cases/get-file-download-url.use-case";
import { PurgeFilesInFolders } from "../files/application/use-cases/purge-files-in-folders.use-case";
import { StartMultipartUpload } from "../files/application/use-cases/start-multipart-upload.use-case";
import { PrismaFileMetadataRepository } from "../files/infra/persistence/prisma-file-metadata-repository";
import { PrismaUploadRepository } from "../files/infra/persistence/prisma-upload-repository";
import { S3ObjectStorage } from "../files/infra/storage/s3-object-storage";
import { CompleteMultipartUploadController } from "../files/presentation/controllers/complete-multipart-upload.controller";
import { GetFileDownloadUrlController } from "../files/presentation/controllers/get-file-download-url.controller";
import { StartMultipartUploadController } from "../files/presentation/controllers/start-multipart-upload.controller";
import type { FileControllers } from "../files/presentation/routes/file.routes";
import type { UploadControllers } from "../files/presentation/routes/upload.routes";
import { CreateRootFolderOnUserCreated } from "../folders/application/event-handlers/create-root-folder-on-user-created";
import { CreateFolder } from "../folders/application/use-cases/create-folder.use-case";
import { CreateRootFolder } from "../folders/application/use-cases/create-root-folder.use-case";
import { DeleteFolder } from "../folders/application/use-cases/delete-folder.use-case";
import { FolderDeleted } from "../folders/domain/events/folder-deleted.event";
import { PrismaFolderRepository } from "../folders/infra/persistence/prisma-folder-repository";
import { CreateFolderController } from "../folders/presentation/controllers/create-folder.controller";
import { DeleteFolderController } from "../folders/presentation/controllers/delete-folder.controller";
import type { FolderControllers } from "../folders/presentation/routes/folder.routes";
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
  // users -> folders: cria a pasta raiz ao cadastrar um usuário.
  eventPublisher.register(
    UserCreated.EVENT_NAME,
    new CreateRootFolderOnUserCreated(new CreateRootFolder(folderRepository)),
  );
  // folders -> files: apaga os arquivos (registros + objetos) das pastas removidas.
  eventPublisher.register(
    FolderDeleted.EVENT_NAME,
    new PurgeFilesOnFolderDeleted(
      new PurgeFilesInFolders(fileMetadataRepository, storage),
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
    storage,
    env.storage.presignExpiresInSeconds,
  );
  // O `complete` grava duas vezes (upload concluído + arquivo criado); ele mesmo
  // abre a transação (via UoW) após a conclusão no storage, então não é decorado.
  const completeUpload = new CompleteMultipartUpload(
    uploadRepository,
    fileMetadataRepository,
    storage,
    unitOfWork,
  );
  // Download — somente leitura, devolve uma URL pré-assinada de GET.
  const getFileDownloadUrl = new GetFileDownloadUrl(
    fileMetadataRepository,
    storage,
    env.storage.presignExpiresInSeconds,
  );

  // Criação de pasta — escrita única, sem UoW.
  const createFolder = new CreateFolder(folderRepository);
  // Remoção de pasta — publica FolderDeleted (o handler de `files` purga os
  // arquivos) e então remove as pastas. S3 é best-effort, fora de transação.
  const deleteFolder = new DeleteFolder(folderRepository, eventPublisher);

  // --- Controllers (presentation) ---
  return {
    userControllers: {
      signUp: new SignUpController(signUp),
      signIn: new SignInController(signIn),
    },
    folderControllers: {
      create: new CreateFolderController(createFolder),
      delete: new DeleteFolderController(deleteFolder),
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
