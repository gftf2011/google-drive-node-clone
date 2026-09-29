// Teste de carga: MUITOS usuários fazendo upload ao mesmo tempo.
//
// Cada VU é um usuário distinto (cadastrado uma vez, com sua própria pasta), então
// o pico de VUs equivale ao número de usuários simultâneos subindo arquivos. Cada
// iteração faz o fluxo completo (start -> PUT pré-assinado -> complete).
//
// Parâmetros (via env):
//   VUS        pico de usuários simultâneos (default 100)
//   FILE_SIZE  tamanho do arquivo em bytes  (default 4096)
//   BASE_URL   alvo (default http://localhost:3333)
//
// Ex.: VUS=200 FILE_SIZE=1048576 k6 run load/many-users-upload.load.js

import { Trend } from "k6/metrics";

import { defaultThresholds } from "./lib/config.js";
import { createFolder, signUp, uploadSmallFile } from "./lib/api.js";

const PEAK = Number(__ENV.VUS || 100);
const FILE_SIZE = Number(__ENV.FILE_SIZE || 4 * 1024);

// Latência do fluxo de upload inteiro (start + PUT + complete), em ms.
const uploadFlow = new Trend("upload_flow_duration", true);

export const options = {
  scenarios: {
    many_users_uploading: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: PEAK }, // muitos usuários chegam
        { duration: "2m", target: PEAK }, // sustenta o pico
        { duration: "30s", target: 0 }, // drena
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    ...defaultThresholds,
    // O fluxo de upload inteiro deve ficar sob 3s no p95, mesmo no pico.
    upload_flow_duration: ["p(95)<3000"],
  },
};

// Por-VU (cada VU tem seu próprio runtime): um usuário e uma pasta por usuário.
let token;
let folderId;

export default function () {
  // Recria usuário/pasta se ainda não há (ou se o cadastro falhou numa iteração
  // anterior — ex.: servidor indisponível momentaneamente).
  if (!token || !folderId) {
    token = signUp();
    if (token) {
      folderId = createFolder(token, "Uploads");
    }
  }
  if (!token || !folderId) {
    return;
  }

  const startedAt = Date.now();
  const fileId = uploadSmallFile(token, folderId, FILE_SIZE);
  if (fileId !== null) {
    uploadFlow.add(Date.now() - startedAt);
  }
}
