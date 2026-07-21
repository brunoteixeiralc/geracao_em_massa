# Geracao Em Massa Reels

App Telegram-first para gerar Reels em lote para Instagram.

O objetivo do projeto e substituir uma interface web por um fluxo direto no Telegram: o usuario envia um lote de videos, escolhe um template fixo, aplica ajustes globais ao lote inteiro, acompanha o processamento em tempo real e recebe os Reels prontos pelo Telegram, com suporte a ZIP para baixar tudo de uma vez.

## Objetivo

Criar um sistema rapido, seguro e simples de operar para geracao em massa de Reels.

Escopo principal:

- somente Reels em formato vertical;
- templates fixos reutilizaveis;
- videos de entrada normalmente com ate 20 MB;
- lotes com ate 50 videos;
- ajustes padrao globais por lote;
- painel vivo de status no Telegram;
- processamento no servidor;
- fila Redis/BullMQ para processar lotes;
- worker separado para baixar arquivos do Telegram e renderizar com FFmpeg;
- persistencia no Turso;
- deploy no Railway;
- entrega individual pelo Telegram e pacote `.zip` ao final;
- testes unitarios como prioridade desde o inicio.

## Fluxo No Telegram

1. O usuario inicia um novo trabalho pelo bot.
2. O bot mostra o template ativo ou permite escolher outro template fixo.
3. O usuario envia os videos do lote.
4. O bot valida quantidade, tamanho e tipo dos arquivos.
5. O usuario confirma os ajustes globais do lote, como zoom, velocidade, cortes, espelhamento, CTA, marca d'agua e antiduplicidade.
6. O bot cria o lote, salva o estado no Turso e envia para a fila.
7. O worker baixa os arquivos originais do Telegram para `WORK_DIR`.
8. O worker valida os caminhos locais e renderiza os videos com FFprobe/FFmpeg.
9. O worker cria o ZIP, envia MP4s/ZIP para storage S3/R2 e salva as URLs no Turso.
10. O bot entrega os Reels prontos quando couberem no limite do Telegram e sempre envia o link do `.zip`.

Comandos iniciais:

- `/start` mostra a mensagem inicial do bot.
- `/novo` cria um novo lote e abre a escolha de template.

Durante o lote, o bot usa botoes inline para escolher template, finalizar envio, alterar ajustes globais e enviar o trabalho para a fila.

## Status Atual

Fundacao tecnica do MVP ja preparada:

- configuracao tipada de ambiente;
- validacao de acesso por usuario autorizado do Telegram;
- validacao de midia de entrada;
- modelo de status do lote e progresso;
- regras de ajustes globais por lote;
- templates fixos iniciais;
- renderizacao e atualizacao ao vivo do painel de status do Telegram;
- fila BullMQ para enfileirar lotes;
- worker inicial para baixar videos do Telegram e renderizar MP4s locais;
- executor FFprobe/FFmpeg sem shell para gerar Reels 9:16;
- empacotamento ZIP dos videos renderizados;
- upload S3/R2 de MP4s e ZIP;
- entrega final pelo Telegram com videos individuais e link do ZIP;
- schema inicial do banco Turso/libSQL;
- repositorios de persistencia;
- testes unitarios das regras principais;
- workflows GitHub para CI, auditoria e CodeQL.

## Stack

| Lib | Onde entra | Por que foi escolhida |
| --- | --- | --- |
| `grammy` | Bot do Telegram | Biblioteca moderna, tipada e objetiva para criar comandos, conversas, botoes e respostas no Telegram. |
| `@grammyjs/runner` | Execucao do bot | Ajuda a rodar o bot de forma mais robusta, com melhor controle de concorrencia e graceful shutdown. |
| `fastify` | Servidor HTTP | Framework rapido e leve para webhooks do Telegram, health checks e rotas internas no Railway. |
| `@fastify/helmet` | Headers de seguranca | Adiciona headers HTTP seguros por padrao, reduzindo riscos comuns em APIs expostas. |
| `@fastify/rate-limit` | Protecao de abuso | Limita excesso de requisicoes, ajudando contra spam, loops e tentativas simples de abuso. |
| `@libsql/client` | Banco Turso | SDK oficial compativel com libSQL/Turso para persistir lotes, videos, eventos e resultados. |
| `bullmq` | Fila de jobs | Controla o processamento assincrono dos lotes, com retry, status e separacao entre bot e worker. |
| `ioredis` | Conexao Redis | Cliente Redis usado pelo BullMQ, adequado para filas em producao. |
| `@aws-sdk/client-s3` | Armazenamento | Envia os arquivos prontos para storage compativel com S3, como Cloudflare R2, AWS S3 ou similares. |
| `@aws-sdk/s3-request-presigner` | Links temporarios | Gera links assinados para entregar arquivos grandes ou ZIPs com prazo controlado. |
| `archiver` | ZIP final | Cria o pacote `.zip` com todos os Reels do lote. |
| `file-type` | Validacao de arquivo | Detecta o tipo real do arquivo por assinatura binaria, evitando confiar apenas no nome do arquivo. |
| `zod` | Validacao de dados | Valida variaveis de ambiente, payloads e configuracoes com mensagens claras e tipos seguros. |
| `dotenv` | Ambiente local | Carrega `.env` no desenvolvimento sem colocar segredos no Git. |
| `nanoid` | IDs internos | Gera IDs curtos e seguros para lotes, jobs e arquivos. |
| `pino` | Logs | Logger rapido e estruturado, bom para Railway, debug e observabilidade. |
| `typescript` | Base do codigo | Reduz erro em tempo de desenvolvimento e melhora manutencao. |
| `tsx` | Execucao local TS | Roda scripts TypeScript no desenvolvimento, como servidor e migrations. |
| `vitest` | Testes unitarios | Test runner rapido para TypeScript, ideal para manter regras do app protegidas. |
| `@vitest/coverage-v8` | Cobertura | Gera relatorios de cobertura usando V8, integrado ao Vitest. |

## Decisoes De Seguranca

- O bot aceita apenas usuarios listados em `TRUSTED_TELEGRAM_USER_IDS`.
- O webhook usa `TELEGRAM_WEBHOOK_SECRET` para reduzir chamadas falsas.
- Arquivos sao validados por tamanho e tipo real, nao apenas por extensao.
- Segredos ficam fora do Git, em `.env` local, Railway variables ou GitHub secrets quando necessario.
- Rate limit fica no servidor HTTP para reduzir abuso de endpoints.
- Headers seguros sao aplicados via `@fastify/helmet`.
- URLs de download devem ser temporarias quando geradas por storage S3.
- O pipeline deve falhar de forma visivel quando Turso, Redis, storage ou Telegram estiverem indisponiveis.

## Qualidade E Testes

O projeto prioriza testes unitarios desde o MVP. A ideia e proteger primeiro as regras que podem causar perda de lote, cobranca errada, arquivo invalido ou painel de status incorreto.

Comandos principais:

```bash
npm run build
npm run start
npm run start:worker
npm run test:unit
npm run test:coverage
npm audit --audit-level=high
```

O CI do GitHub executa build, testes, cobertura e auditoria de dependencias.

## Ambiente Local

Use Node.js 22 ou superior.

Instale as dependencias:

```bash
npm install
```

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Preencha os valores reais no `.env`.

Variaveis principais:

| Variavel | Uso |
| --- | --- |
| `NODE_ENV` | Ambiente da aplicacao. |
| `PORT` | Porta HTTP usada pelo Fastify. |
| `TELEGRAM_BOT_TOKEN` | Token do bot criado no Telegram. |
| `TELEGRAM_WEBHOOK_SECRET` | Segredo enviado pelo Telegram no webhook. |
| `TRUSTED_TELEGRAM_USER_IDS` | Lista de usuarios autorizados. |
| `PUBLIC_WEBHOOK_BASE_URL` | URL publica do Railway para configurar webhook. |
| `TURSO_DATABASE_URL` | URL do banco Turso/libSQL. |
| `TURSO_AUTH_TOKEN` | Token de acesso ao Turso. |
| `REDIS_URL` | Redis usado pelo BullMQ. |
| `S3_ENDPOINT` | Endpoint do storage compativel com S3. |
| `S3_REGION` | Regiao do storage. |
| `S3_BUCKET` | Bucket onde os Reels prontos serao salvos. |
| `S3_ACCESS_KEY_ID` | Chave de acesso do storage. |
| `S3_SECRET_ACCESS_KEY` | Segredo do storage. |
| `PUBLIC_ASSET_BASE_URL` | URL publica ou base para entrega de arquivos. |
| `WORK_DIR` | Pasta privada de processamento local. Default: `.data/reels-bot`. |
| `MAX_BATCH_VIDEOS` | Limite de videos por lote. |
| `MAX_INPUT_BYTES` | Tamanho maximo por video de entrada. |
| `MAX_TELEGRAM_SEND_BYTES` | Limite para envio direto pelo Telegram. |
| `WORKER_CONCURRENCY` | Quantidade de jobs processados em paralelo. |

## Banco De Dados

O projeto usa Turso, baseado em libSQL/SQLite.

Rodar migrations:

```bash
npm run db:migrate
```

O schema inicial cria tabelas para:

- lotes;
- videos do lote;
- eventos de status;
- resultados gerados.

As migrations sao aplicadas em ordem com:

```bash
npm run db:migrate
```

## Deploy No Railway

O Railway sera usado para hospedar o servidor do bot e o worker de processamento.

Configuracao esperada:

- variaveis de ambiente configuradas no Railway;
- Turso acessivel por `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`;
- Redis disponivel para BullMQ;
- storage S3/R2 configurado para arquivos prontos;
- `WORK_DIR` apontando para uma pasta privada do container, fora de `/tmp`;
- deploy usando o `Dockerfile`, que instala `ffmpeg` e `ffprobe`;
- health check HTTP exposto pelo Fastify.

Processo web:

```bash
npm run build
npm run start
```

Processo worker:

```bash
npm run build
npm run start:worker
```

No Railway, o ideal e ter dois services usando o mesmo repositorio:

- `web`: recebe webhooks do Telegram e enfileira lotes;
- `worker`: consome a fila BullMQ, baixa os arquivos do Telegram, valida duracao com FFprobe, renderiza MP4s, cria ZIP, faz upload S3/R2 e entrega o resultado no Telegram.

O `Dockerfile` usa `npm run start` como comando padrao para o service `web`.
No service `worker`, configure o comando inicial como:

```bash
npm run start:worker
```

## GitHub

O repositorio foi pensado para usar bastante o GitHub:

- issues para planejar trabalho;
- branches por issue ou feature;
- pull requests para toda mudanca;
- checklist de PR com testes e seguranca;
- GitHub Actions para CI;
- CodeQL para analise de seguranca em TypeScript;
- Dependabot para dependencias npm e GitHub Actions;
- GitHub Releases geradas automaticamente a partir da versao do `package.json`;
- branch protection ou rulesets no `main`;
- GitHub secrets apenas quando algum workflow realmente precisar.

Veja tambem:

- `docs/github-workflow.md`
- `docs/railway-staging.md`
- `SECURITY.md`

## Releases

Releases sao criadas automaticamente quando um merge na `main` traz uma versao nova no `package.json`.

O workflow `.github/workflows/auto-release.yml` roda em todo push na `main`, executa `npm ci`, build, testes unitarios, cobertura e auditoria de seguranca. Se tudo passar, ele le a versao do `package.json`, monta a tag `vX.Y.Z`, verifica se essa tag ainda nao existe e cria a tag + GitHub Release com notas automaticas.

Formato aceito:

```text
v0.1.0
v0.2.0
v1.0.0
v1.0.0-beta.1
```

Antes de criar a tag, a versao do `package.json` deve ser a mesma da tag sem o `v`.

Exemplo para publicar `v0.4.0`:

```bash
git switch main
git pull --ff-only
git switch -c release/v0.4.0
npm version 0.4.0 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump version to 0.4.0"
git push -u origin release/v0.4.0
```

Depois que o PR for aprovado, os checks passarem e o merge for feito na `main`, o workflow automatico cria a tag e a release. Se a tag da versao ja existir, o workflow pula a criacao sem falhar.

O workflow `.github/workflows/release.yml` continua existindo como fallback para tags semanticas criadas manualmente. Quando uma tag manual e enviada, ele roda:

- `npm ci`;
- validacao da tag contra `package.json`;
- build TypeScript;
- testes unitarios;
- cobertura;
- auditoria de seguranca;
- criacao da GitHub Release com notas automaticas.

## Estrutura

```text
src/
  bot/          Painel e teclados do Telegram
  config/       Variaveis de ambiente tipadas
  db/           Cliente Turso, migrations e repositorios
  delivery/     Entrega final pelo Telegram
  packager/     Criacao de ZIPs do lote
  renderer/     Planejamento e execucao de renderizacao com FFprobe/FFmpeg
  security/     Acesso autorizado e validacao de midia
  storage/      Upload S3/R2 e URLs publicas
  templates/    Templates fixos
  workflow/     Regras de lote, ajustes e status

assets/
  templates/    Templates versionados com template.json, preview e avatar

tests/
  bot/
  ci/
  config/
  db/
  delivery/
  packager/
  queue/
  renderer/
  security/
  server/
  storage/
  templates/
  worker/
  workflow/

db/
  migrations/

docs/
  github-workflow.md
  railway-staging.md
```

## Templates

Os templates fixos ficam versionados no GitHub em `assets/templates/<id>/template.json`. Cada pasta tambem deve conter os assets referenciados pelo JSON, como `avatar.svg` e `preview.svg`.

Exemplo:

```text
assets/templates/
  humor-crocodilo/
    template.json
    avatar.svg
    preview.svg
```

O bot carrega automaticamente os templates validos dessa pasta. Se um `template.json` estiver invalido ou apontar para asset inexistente, os testes falham antes do deploy.

## Proximas Etapas

- Melhorar ajustes avancados do lote no Telegram.
- Adicionar testes de integracao com videos pequenos reais no FFmpeg.
- Fazer smoke test em staging no Railway com Telegram, Redis, Turso e S3/R2 reais.
