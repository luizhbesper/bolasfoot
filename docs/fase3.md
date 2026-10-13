# Fase 3 — Servidor, contas e jogos (tickets)

Detalhe dos tickets S1–S7 do `plano.md`. Gate: dois usuários criados por convite no staging avançam rodadas com uma UI crua (botão "pronto" + lista de resultados).

**Decisões da fase**
- **Dependências novas, só estas:** `drizzle-orm`, `drizzle-kit` (dev) e `postgres` (postgres.js). O resto vem do `node:crypto` (scrypt, tokens, sha256) e do `node:zlib` (gzip). Sem lib de auth e sem lib de SSE.
- **A base no servidor:** `@bolasfoot/data/base.json` importada uma vez em `lib/game/base.ts`.
- **Snapshot:** `gzipSync(JSON.stringify(mundo))` em `bytea`. O cliente recebe os bytes direto, com `Content-Encoding: gzip`. O tamanho é medido na S5; diff só se passar de ~1 MB.
- **Seeds:** `game_seed = randomBytes(16)` em hex; `roundSeed = sha256(gameSeed + ':' + n)`. O `seed_hash` é publicado quando o planejamento abre e a seed é revelada depois que os comandos travam.
- **Uma rodada do motor = uma linha em `rounds`.** Fases: `planejamento → ao_vivo_1t → intervalo → ao_vivo_2t → resultados → planejamento`. O modo live chama `avancarRodada(..., intervalo = true)`; com `fase: 'intervalo'`, o `mundo.emJogo` fica no snapshot até o `continuarRodada`. O flag vem de `games.mode` (o daily, Fase 5, usa `false`).
- **Partida ao vivo (§3.3):** a resolução grava os eventos das `Rodada.partidas` em `round_logs` e publica `{startAt, msPorMinuto, eventos}`. O prazo da fase `ao_vivo_*` é a duração do tempo (último minuto × `ms_per_minute`). A animação é da U4; aqui a UI crua lista eventos e placar.
- **Concorrência:** toda transição roda numa transação com `SELECT … FROM games WHERE id = $1 FOR UPDATE` e confere fase e nº da rodada antes de agir. O agendador, o último ready e o "forçar" do admin chamam a mesma função; só um resolve.
- **Agendador:** `setInterval` de 1 s no `instrumentation.ts` (só com `NEXT_RUNTIME === 'nodejs'`), que procura prazos vencidos.
- **SSE:** canal em memória por jogo (`lib/game/canal.ts`); o route handler devolve um `ReadableStream`. As boas-vindas trazem o estado atual e `serverNow` (offset do relógio). Reconectar = novo GET.
- **Testes de integração:** Vitest em `apps/web` contra o `bolasfoot_test`. O CI sobe Postgres como `services:` no job `check`.
- **Rota de teste** (`TEST_ENDPOINTS=1`): forçar o prazo vencido de um jogo. Só essa.

**Ordem:** S1 → S2 → S3 → S5 → S6 → S4 → S7. A S4 vem depois da S5/S6 porque cria o mundo e usa os picks ao vivo.

```
apps/web/
  drizzle.config.ts, drizzle/   S1
  lib/db/schema.ts, index.ts    S1
  lib/auth/                     S2
  app/entrar, app/convite       S2
  app/admin                     S3
  lib/game/rodada.ts            S5 (transicionar, comandos, ready)
  lib/game/agendador.ts         S5
  lib/game/canal.ts             S6
  app/api/games/[id]/eventos    S6
  app/api/games/[id]/snapshot   S6
  app/jogo/[id]                 S4/S6 (UI crua)
```

---

## S1 — Schema, migrations e seed
Objetivo: o banco da §2.6 versionado e um admin criado.
Fonte original: n/a.
Contrato: `lib/db/schema.ts` (`users`, `sessions`, `invites`, `games`, `game_settings`, `game_members`, `rounds`, `commands`, `snapshots`, `round_logs`; `ON DELETE CASCADE` em tudo que pende de `games`; defaults de `game_settings` no banco), `lib/db/index.ts` (`db`), `drizzle.config.ts`; scripts `db:migrate`, `db:seed` (admin de `ADMIN_USERNAME`/`ADMIN_PASSWORD`, idempotente), `db:reset` (recusa fora de `APP_ENV=local`).
Fora de escopo: a lógica de senha (S2; o seed já usa o `hashSenha` dela, então S1 traz só essa função).
Testes: integração — migrate + seed no `bolasfoot_test`; seed duas vezes não duplica.
Pronto quando: `pnpm check` verde, local e no CI com o Postgres de service.

## S2 — Login, sessão e convites
Objetivo: entrar só por convite (§2.4).
Fonte original: n/a.
Contrato: `hashSenha`/`conferirSenha` (scrypt + salt, `timingSafeEqual`); `criarSessao`/`sessaoAtual`/`encerrarSessao` (token de 32 bytes em cookie `httpOnly`, `sameSite=lax`, `secure` fora de local); rate limit por IP no login (memória); `resgatarConvite(codigo, dados)` — cria a conta ou adiciona o jogo à conta logada; recusa revogado, esgotado ou vencido; conta o uso na mesma transação. Telas cruas: `/entrar`, `/convite`, sair.
Fora de escopo: visual (U2).
Testes: integração §6.4 #1.

## S3 — Painel do admin
Objetivo: o admin administra os jogos.
Fonte original: n/a.
Contrato: `/admin` com server actions guardadas por `exigirAdmin()`: criar jogo (nome, modo, `habilidadeIndividual`, `salarioMensal`, times proibidos e divisões permitidas em `games.config`), gerar e revogar convite (código `XXXX-XX`, usos, validade), editar `game_settings`, expulsar, pausar/retomar, forçar avanço (S5), apagar com confirmação.
Fora de escopo: visual (U2).
Testes: os das actions críticas entram na integração da S5 (forçar, apagar em cascata).

## S4 — Lobby e escolha de times
Objetivo: membros escolhem time e o mundo nasce (§3.5).
Fonte original: a divisão BR por `Nivel` do `novoJogo` (`best/Z.java:112-228`); exportar do motor se ainda não estiver.
Contrato: `games.status` `lobby → picking → running`; buscador sobre `base.times` (nome, UF, divisão) com os filtros do `games.config`; pick com `UNIQUE (game_id, team_ref)`, evento SSE `pick`; todos ready ou prazo → `novoJogo(base, opcoes, gameSeed)` + `contratarTecnicoHumano` + `abrirCaixa` por membro, `tecnico_id` no membro, snapshot da rodada 0 e o 1º planejamento.
Fora de escopo: visual do buscador (U2).
Testes: integração — dois membros não pegam o mesmo time; mundo criado com os dois humanos nos times escolhidos.

## S5 — Máquina de estados
Objetivo: o servidor joga as rodadas (§3.2).
Fonte original: n/a (usa `avancarRodada`/`continuarRodada`/`validar` da W8).
Contrato: `lib/game/rodada.ts` — `abrirPlanejamento`, `enviarComandos` (valida com `validar` contra o snapshot; grava em `commands`), `marcarReady`, `transicionar(gameId)` (única função que muda fase). Resolução: snapshot → motor com `roundSeed` → snapshot novo, `round_logs` (partidas, resultados dos comandos, avisos), seed revelada → canal. `paused` congela o agendador. `lib/game/agendador.ts` no `instrumentation.ts`.
Fora de escopo: prazo por horário (D1).
Testes: integração §6.4 #2 (inclui `transicionar` concorrente ×5 resolvendo uma vez e `sha256(seed) === seed_hash`). Medir o tamanho do snapshot.

## S6 — SSE e UI crua
Objetivo: todos veem a mesma fase ao mesmo tempo.
Fonte original: n/a.
Contrato: `GET /api/games/[id]/eventos` (só membro): boas-vindas `{serverNow, fase, prazo, prontos, rodada}`, depois `fase`, `ready`, `pick`, `aoVivo`, `resultados`; heartbeat de 15 s; limpa no `abort`. `GET /api/games/[id]/snapshot` (gzip direto). `/jogo/[id]`: fase, prazo, prontos, botão "pronto", resultados da última rodada.
Fora de escopo: partida animada (U4).
Testes: E2E smoke com dois contextos fica para o gate (§6.5 #1 é da Fase 4).

## S7 — Deploy no Railway
Objetivo: staging e prod no ar.
Fonte original: n/a.
Contrato: environments `staging` (push em `dev`) e `production` (push em `main`), um Postgres por environment, vars da §2.7; start `pnpm db:migrate && pnpm db:seed && pnpm start`; assets servidos pelo Next (conferir se `public/assets` está no git ou é gerado no build).
Fora de escopo: domínio próprio.
Pronto quando: o gate da fase passa no staging. Criar os recursos no Railway só com a confirmação do usuário.
