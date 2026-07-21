# Railway Staging

Guia para subir um ambiente de staging do bot de geracao em massa de Reels no Railway.

O staging deve validar o caminho real de producao com poucos videos: Telegram webhook, Turso, Redis, S3/R2, worker, renderizacao FFmpeg, entrega individual e ZIP final.

## Arquitetura No Railway

Crie dois services apontando para o mesmo repositorio GitHub e mesma branch de deploy.

| Service | Tipo | Start command | Responsabilidade |
| --- | --- | --- | --- |
| `web` | HTTP | `npm run start` | Recebe webhooks do Telegram, valida usuario, cria lotes e publica jobs na fila. |
| `worker` | Worker | `npm run start:worker` | Consome BullMQ, baixa videos, renderiza MP4s, cria ZIP, envia para S3/R2 e entrega no Telegram. |

O `Dockerfile` fica na raiz do repositorio e instala `ffmpeg`, `ffprobe`, dependencias npm e build TypeScript. O comando padrao do Dockerfile ja atende o service `web`. No service `worker`, configure o start command manualmente como `npm run start:worker`.

## Build E Healthcheck

Configure o service `web` com:

- Dockerfile detectado na raiz do repositorio;
- start command `npm run start`;
- healthcheck path `/health`;
- porta vinda da variavel `PORT` injetada pelo Railway.

O endpoint `/health` deve responder HTTP 200 com:

```json
{
  "ok": true,
  "service": "geracao-em-massa-reels"
}
```

O service `worker` nao precisa receber trafego HTTP publico. Ele precisa das mesmas variaveis de runtime do `web`, porque acessa Turso, Redis, Telegram e S3/R2.

## Variaveis

Configure as variaveis nos dois services, exceto quando indicado.

| Variavel | Service | Valor de staging |
| --- | --- | --- |
| `NODE_ENV` | `web`, `worker` | `production` |
| `PORT` | `web` | Deixe o Railway injetar ou defina uma porta fixa somente se necessario. |
| `TELEGRAM_BOT_TOKEN` | `web`, `worker` | Token do bot de staging criado no BotFather. |
| `TELEGRAM_WEBHOOK_SECRET` | `web`, `worker` | String aleatoria com pelo menos 32 bytes. |
| `TRUSTED_TELEGRAM_USER_IDS` | `web`, `worker` | IDs numericos autorizados, separados por virgula. |
| `PUBLIC_WEBHOOK_BASE_URL` | `web`, `worker` | URL publica do service `web`, sem barra final. |
| `TURSO_DATABASE_URL` | `web`, `worker` | URL do banco Turso de staging. |
| `TURSO_AUTH_TOKEN` | `web`, `worker` | Token do Turso com acesso ao banco de staging. |
| `REDIS_URL` | `web`, `worker` | URL do Redis usado pela fila BullMQ. |
| `S3_ENDPOINT` | `web`, `worker` | Endpoint S3/R2. |
| `S3_REGION` | `web`, `worker` | Regiao do bucket. Para R2, geralmente `auto`. |
| `S3_BUCKET` | `web`, `worker` | Bucket de staging para MP4s e ZIPs. |
| `S3_ACCESS_KEY_ID` | `web`, `worker` | Access key do storage. |
| `S3_SECRET_ACCESS_KEY` | `web`, `worker` | Secret key do storage. |
| `PUBLIC_ASSET_BASE_URL` | `web`, `worker` | Base publica para acessar os arquivos enviados ao storage. |
| `WORK_DIR` | `web`, `worker` | Caminho privado fora de `/tmp`, por exemplo `.data/reels-bot`. |
| `MAX_BATCH_VIDEOS` | `web`, `worker` | `50` |
| `MAX_INPUT_BYTES` | `web`, `worker` | `20971520` para 20 MB. |
| `MAX_TELEGRAM_SEND_BYTES` | `web`, `worker` | `52428800` para 50 MB. |
| `WORKER_CONCURRENCY` | `worker` | Comece com `1`; aumente somente apos medir CPU/memoria. |

Nao coloque segredos no GitHub ou no repositorio. Use Railway Variables para runtime e GitHub Secrets apenas para workflows que realmente precisarem acessar servicos externos.

## Turso

Use um banco separado para staging.

Antes do primeiro smoke test, rode as migrations contra as variaveis de staging:

```bash
railway run npm run db:migrate
```

Se preferir rodar localmente, carregue as credenciais de staging no `.env` local temporario e execute:

```bash
npm run db:migrate
```

O app deve falhar de forma visivel se `TURSO_DATABASE_URL` ou `TURSO_AUTH_TOKEN` estiverem invalidos.

## Redis

Crie um Redis no Railway ou use um Redis externo de staging. O mesmo `REDIS_URL` deve estar nos services `web` e `worker`.

Sinais esperados:

- `web` consegue enfileirar lote;
- `worker` consome o job;
- falha de Redis aparece nos logs em vez de ser ignorada silenciosamente.

## S3/R2

Use um bucket separado para staging, com permissao minima para gravar e ler os objetos gerados.

Padrao de objetos esperado:

```text
batches/<batchId>/videos/<videoId>.mp4
batches/<batchId>/<batchId>.zip
```

`PUBLIC_ASSET_BASE_URL` deve apontar para uma URL acessivel pelo Telegram e pelo navegador. Se o bucket nao for publico, a entrega por link deve usar uma camada de URL publica ou assinada antes de liberar staging para uso real.

## Telegram Webhook

Depois do deploy do service `web`, configure o webhook do bot de staging para:

```text
${PUBLIC_WEBHOOK_BASE_URL}/telegram/${TELEGRAM_WEBHOOK_SECRET}
```

A chamada ao Telegram deve enviar o header secreto:

```text
X-Telegram-Bot-Api-Secret-Token: ${TELEGRAM_WEBHOOK_SECRET}
```

Checklist:

- o bot usado em staging e diferente do bot de producao;
- `TRUSTED_TELEGRAM_USER_IDS` contem apenas usuarios autorizados;
- `/health` responde 200 antes de configurar o webhook;
- comandos `/start` e `/novo` respondem no Telegram.

## Smoke Test

Rode este teste com 2 ou 3 videos pequenos antes de liberar lotes maiores.

1. Abra o chat com o bot de staging.
2. Envie `/start`.
3. Envie `/novo`.
4. Confirme o template fixo padrao.
5. Envie 2 ou 3 videos com menos de 20 MB cada.
6. Finalize o envio e confirme os ajustes globais padrao.
7. Confirme o processamento.
8. Observe o painel vivo de status no Telegram mudando de fase na mesma mensagem.
9. Confirme nos logs que o `web` criou o lote e publicou o job.
10. Confirme nos logs que o `worker` passou por download, renderizacao, ZIP, upload e entrega.
11. Verifique se os MP4s foram entregues quando couberem no limite do Telegram.
12. Abra o link do ZIP e confira se os arquivos finais estao dentro do pacote.
13. Verifique no Turso se o lote terminou como `completed`.
14. Verifique no bucket se os objetos foram criados dentro de `batches/<batchId>/`.

## Criterios De Aceite

O staging esta pronto para evoluir quando:

- deploy do `web` fica saudavel com `/health`;
- deploy do `worker` inicia sem erro de ambiente;
- migrations rodam no Turso de staging;
- Telegram aceita o webhook com secret;
- usuario nao autorizado e bloqueado;
- lote pequeno passa de ponta a ponta;
- falhas aparecem nos logs com fase e mensagem clara;
- MP4s e ZIP ficam disponiveis no storage;
- nenhum segredo aparece em logs, README, docs ou commits.

## Rollback

Se o staging quebrar apos uma mudanca:

1. Pause o uso do bot de staging.
2. Remova ou troque o webhook no Telegram.
3. Volte o deploy do Railway para o ultimo deployment saudavel.
4. Confira se o worker antigo nao esta processando jobs incompativeis.
5. Abra uma issue no GitHub com logs do `web`, logs do `worker`, batch id e horario.

## Referencias

- Railway Dockerfile docs: https://docs.railway.com/builds/dockerfiles
- Railway start command docs: https://docs.railway.com/deployments/start-command
- Railway variables docs: https://docs.railway.com/variables
- Railway healthcheck docs: https://docs.railway.com/deployments/healthchecks
