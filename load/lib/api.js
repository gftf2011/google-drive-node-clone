// Helpers da API usados pelo teste de carga. Cada função faz a requisição, um
// `check` funcional e devolve o dado relevante. As requisições recebem uma tag
// `name` para o k6 agrupar as métricas por rota (e não por URL com ids).

import http from "k6/http";
import { check } from "k6";

import { BASE_URL } from "./config.js";

const JSON_TYPE = "application/json";

function jsonParams(token, name) {
  const headers = { "Content-Type": JSON_TYPE };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { headers, tags: { name } };
}

/** Cadastra um usuário único e devolve o token de acesso. */
export function signUp() {
  const email = `k6_${__VU}_${__ITER}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}@example.com`;
  const res = http.post(
    `${BASE_URL}/users`,
    JSON.stringify({ name: "K6 User", email, password: "password123" }),
    jsonParams(null, "POST /users"),
  );
  const ok = check(res, { "sign up -> 201": (r) => r.status === 201 });
  // Sem estourar quando a requisição falha (ex.: servidor fora) — o check
  // registra a falha e a iteração segue.
  return ok ? res.json("token") : null;
}

/** Cria uma pasta e devolve seu id (parentId ausente = raiz). */
export function createFolder(token, name, parentId) {
  const body = parentId === undefined ? { name } : { name, parentId };
  const res = http.post(
    `${BASE_URL}/folders`,
    JSON.stringify(body),
    jsonParams(token, "POST /folders"),
  );
  const ok = check(res, { "create folder -> 201": (r) => r.status === 201 });
  return ok ? res.json("folderId") : null;
}

/**
 * Faz o fluxo completo de upload de um arquivo pequeno (uma parte):
 * start -> PUT na URL pré-assinada -> complete. Devolve o fileId (ou null se o
 * start falhar, ex.: cota excedida).
 */
export function uploadSmallFile(token, folderId, sizeBytes = 1024) {
  const payload = "x".repeat(sizeBytes);

  const start = http.post(
    `${BASE_URL}/uploads`,
    JSON.stringify({
      folderId,
      fileName: "load.bin",
      contentType: "application/octet-stream",
      size: payload.length,
    }),
    jsonParams(token, "POST /uploads"),
  );
  const started = check(start, {
    "start upload -> 201": (r) => r.status === 201,
  });
  if (!started) {
    return null;
  }

  const body = start.json();
  const part = body.parts[0];
  const put = http.put(part.url, payload, {
    headers: { "Content-Type": "application/octet-stream" },
    tags: { name: "PUT part (storage)" },
  });
  check(put, { "put part -> 200": (r) => r.status === 200 });

  const complete = http.post(
    `${BASE_URL}/uploads/${body.uploadId}/complete`,
    JSON.stringify({
      parts: [{ partNumber: 1, etag: put.headers["Etag"] }],
    }),
    jsonParams(token, "POST /uploads/:id/complete"),
  );
  check(complete, { "complete upload -> 200": (r) => r.status === 200 });
  return complete.json("fileId");
}
