// Configuração compartilhada dos testes de carga (k6).

/** URL base da API sob teste. Sobrescreva com BASE_URL=... k6 run ... */
export const BASE_URL = (__ENV.BASE_URL || "http://localhost:3333").replace(
  /\/$/,
  "",
);

/**
 * Thresholds padrão — o run FALHA se violados:
 *   - menos de 1% de requisições com erro de rede/5xx;
 *   - p95 de latência abaixo de 1.5s (inclui os PUT/GET pré-assinados no storage);
 *   - mais de 99% dos checks funcionais passando.
 */
export const defaultThresholds = {
  http_req_failed: ["rate<0.01"],
  http_req_duration: ["p(95)<1500"],
  checks: ["rate>0.99"],
};
