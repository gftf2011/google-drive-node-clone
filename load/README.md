# Teste de carga (k6)

Teste de carga da API com [k6](https://k6.io): **muitos usuários fazendo upload
ao mesmo tempo**. Cada VU é um usuário distinto (cadastrado uma vez, com sua
pasta), então o pico de VUs equivale ao número de usuários simultâneos subindo
arquivos. Cada iteração roda o fluxo completo: `start → PUT (URL pré-assinada) →
complete`.

## Pré-requisitos

- **k6** instalado (`brew install k6`, ou veja https://k6.io/docs/get-started/installation/).
- A stack no ar: `docker compose up -d` (PostgreSQL + floci), migrations aplicadas
  (`npm run prisma:migrate:deploy`) e o servidor rodando (`npm run dev`).

## Como rodar

```bash
npm run load:many-users-upload

# Controlando a intensidade e o alvo:
VUS=300 FILE_SIZE=1048576 BASE_URL=http://localhost:3333 \
  k6 run load/many-users-upload.load.js
```

Parâmetros (via env):

| Var         | Default                  | Descrição                        |
| ----------- | ------------------------ | -------------------------------- |
| `VUS`       | `100`                    | Pico de usuários simultâneos     |
| `FILE_SIZE` | `4096`                   | Tamanho do arquivo, em bytes     |
| `BASE_URL`  | `http://localhost:3333`  | Alvo                             |

## Estrutura

```
load/
├── lib/
│   ├── config.js              # BASE_URL e thresholds padrão
│   └── api.js                 # helpers: signUp, createFolder, uploadSmallFile
└── many-users-upload.load.js  # o teste
```

## Thresholds

O run **falha** se violados:

- `http_req_failed: rate<0.01` — < 1% de erros de rede/5xx.
- `http_req_duration: p(95)<1500ms` — inclui o `PUT` pré-assinado no storage.
- `checks: rate>0.99` — > 99% das asserções funcionais passando.
- `upload_flow_duration: p(95)<3000ms` — latência do fluxo de upload INTEIRO
  (start + PUT + complete), métrica dedicada mesmo no pico.

Cada requisição é etiquetada (tag `name`) por rota, então o resumo do k6 mostra a
latência agrupada por endpoint (e não por URL com ids).

## Observações

- Rodar contra o `floci` local mede o simulador, não a AWS real; para números de
  produção, aponte `BASE_URL` para um ambiente com S3 real.
- Arquivos pequenos por padrão para focar a carga na API e no fluxo; aumente
  `FILE_SIZE` para estressar a transferência de bytes.
