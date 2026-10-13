# Bolasfoot — plano macro

Port do Brasfoot 22-23 para o navegador, multiplayer com amigos. Este documento fixa a **arquitetura**, as **fases** e o **harness** (como o jogo roda e como cada sessão de trabalho é tocada). Detalhe fino fica em cada ticket.

Referências: `docs/engenharia-reversa.md` (fórmulas), `original/src` (Java decompilado), `original/game/Manual_Brasfoot.pdf` (regras e telas).

---

## 1. Princípios

1. **Fidelidade primeiro — nas regras.** Fórmula, constante e tabela vêm do Java original, com citação `arquivo:linha` no código. Inventar só onde o original não se aplica (multiplayer). **A UI não é cópia:** o layout original é inspiração, a interface é moderna (ver "Diretrizes de UI" na Fase 4).
2. **Um motor, dois lugares.** `packages/engine` é TypeScript puro, sem IO, sem `Math.random`, sem `Date`. Roda igual no servidor e no navegador.
3. **Determinismo.** `estado(n+1) = avançar(estado(n), comandos(n), seed(n))`. Mesmo input → mesmo output, bit a bit. Isso dá replay, debug, testes "golden" e sincronização.
4. **Servidor é a autoridade.** Tudo vive no servidor: jogos, mundo, histórico. O cliente usa o motor para *ver* (tabelas, prévias, animação da partida) e *validar* comandos antes de enviar; quem resolve a rodada é o servidor.
5. **Bugs do original que dão "sabor" ficam** (ex.: `d7` sobrescrito no chute). Bugs que só atrapalham (teto do estádio) são corrigidos. Cada um fica listado no ticket do módulo.
6. **Pouca infraestrutura.** Um app Next.js, um Postgres, um processo. Escala é problema que não existe para 2–10 amigos.

---

## 2. Arquitetura

### 2.1 Monorepo

pnpm workspaces, sem Turborepo até doer.

```
apps/web/            Next.js (App Router): UI, API, SSE, auth, agendador
  app/               rotas e telas
  lib/db/            schema Drizzle + migrations + queries
  lib/auth/          login, sessão, convites
  lib/game/          orquestração da rodada (máquina de estados, resolução)
  e2e/               Playwright (poucos testes)
  public/assets/     escudos, camisas, bandeiras, sons (copiados do original)
packages/engine/     motor puro: modelo, RNG, partida, calendário, competições, IA, economia
packages/data/       ETL: original/data/*.jsonl → base.json; depois, importador de API
tools/               extract.sh, Dump.java (existentes)
docker-compose.yml   Postgres local
.env.example
docs/
original/            gitignored
```

Repositório **privado** (assets e dados são do Brasfoot).

### 2.2 O que roda onde

| Peça | Servidor | Navegador |
|---|---|---|
| Motor (`packages/engine`) | resolve rodadas | prévias, validação, consultas, animação |
| Estado do mundo | fonte da verdade (Postgres) | cópia read-only baixada a cada rodada |
| Comandos do técnico (escalação, compra, preço do ingresso…) | guardados e aplicados na resolução | montados na UI, validados localmente, enviados por POST |
| Partida ao vivo | simula o tempo inteiro de uma vez, grava o log de eventos | toca o log contra o relógio |
| Seeds | gera, guarda, revela depois de travar os comandos | recebe a seed revelada |
| Agendador de prazos | `setInterval` no `instrumentation.ts` | — |

**Por que não "tudo no front com seed", como cassino:** se o cliente simula, cada cliente precisa do mesmo estado e dos comandos de todos, e qualquer um pode alterar o resultado. Mantendo o servidor como autoridade com o *mesmo* código, ganhamos o mesmo efeito (todos veem a mesma coisa, aleatoriedade reprodutível) sem consenso entre clientes. A parte "cassino" que vale a pena fica: **commit-reveal** (seção 2.5).

### 2.3 Stack

| Camada | Escolha | Por quê |
|---|---|---|
| App | Next.js App Router, React, TypeScript | UI + API num lugar só |
| Estilo | CSS Modules + tokens CSS (paleta fixa, inspirada no original) | sem lib de UI; sem temas configuráveis |
| Estado no cliente | estado React + o snapshot do mundo | sem Redux/Zustand até precisar |
| Tempo real | **SSE** (servidor → cliente) + POST (cliente → servidor) | sem servidor WebSocket; funciona num processo Node |
| Auth | usuário + senha próprios, cadastro só com código de convite (2.4) | sem login social, sem lib de auth |
| Banco | **Postgres** + Drizzle | relacional para meta e configurações, `bytea` para o mundo |
| Hospedagem | Railway: 1 serviço Next (Node long-running) + 1 Postgres por ambiente | SSE e agendador precisam de processo vivo |
| Testes | Vitest (motor), Playwright (E2E) | |
| CI | GitHub Actions, 1 workflow | |

### 2.4 Login e convites

Sistema próprio, mínimo:

- **Convite:** o admin gera um código curto (ex.: `K7QX-2M`) ligado a um jogo. Quem recebe abre o site, digita o código e:
  - se não tem conta, cria uma com usuário + senha (sem regra de senha: qualquer uma serve);
  - se já tem, entra e o código só adiciona o jogo à conta dele.
- Código tem uso máximo e validade configuráveis; o admin pode revogar.
- **Senha:** sem exigência de força, mas guardada com hash `scrypt` do `node:crypto` (stdlib, zero dependência). Nunca em texto puro.
- **Sessão:** token aleatório num cookie `httpOnly`, linha na tabela `sessions`. Logout apaga a linha.
- **Admin:** a conta criada pelo `pnpm db:seed` a partir de `ADMIN_USERNAME`/`ADMIN_PASSWORD` do `.env`. Só o admin cria e apaga jogos. Um usuário pode estar em vários jogos.
- Rate limit simples no login (contador em memória por IP) para não virar porta aberta.

### 2.5 Aleatoriedade e seeds

- PRNG próprio no motor: `sfc32` (ou xoshiro128\*\*), seed de 128 bits, derivação por hash de string (`cyrb128`/`splitmix`).
- Hierarquia de seeds, para que mudar um subsistema não embaralhe os outros:
  ```
  gameSeed (crypto, gerada na criação do jogo)
   └ roundSeed = H(gameSeed, nºrodada)
      ├ rng("dia:2026-03-15")
      ├ rng("partida:<id>:1T") / rng("partida:<id>:2T")
      ├ rng("ia:transferencias")
      └ rng("evolucao")
  ```
- API do RNG imita o Java: `int(n)` = `nextInt(n)`, `float()` = `nextDouble()`, `weighted([...])`. O port fica linha a linha legível.
- **Commit-reveal:** ao abrir a fase de planejamento o servidor publica `sha256(roundSeed)`; depois que os comandos travam, revela `roundSeed`. Ninguém (nem o admin) consegue "testar seeds" ou prever resultados para otimizar a escalação.
- Regra de lint no motor: proibido `Math.random`, `Date`, `crypto`, `Math.pow/exp/sin` (variam entre engines JS; usar multiplicação ou tabela). Um `grep` no CI resolve.

### 2.6 Banco de dados

O motor trabalha com o mundo inteiro em memória (≈200 times BR + estrangeiros das continentais, ≈6–8k jogadores). Normalizar isso em tabelas não traz nada; o mundo é guardado inteiro, serializado. O resto é relacional.

| Tabela | Conteúdo |
|---|---|
| `users` | usuário, hash da senha, `is_admin` |
| `sessions` | token, usuário, expiração |
| `invites` | código, jogo, criado por, usos máximos, usos, validade, revogado |
| `games` | nome, admin, modo (`live` / `daily`), configuração do jogo (JSONB, seção 3.5), `game_seed` (secreta), status (`lobby`, `picking`, `running`, `paused`, `finished`), nº da rodada atual |
| `game_settings` | 1 linha por jogo, colunas tipadas com default no banco (abaixo) |
| `game_members` | usuário ↔ jogo ↔ técnico no mundo; time escolhido; `ready` (da escolha de times e da rodada atual) |
| `rounds` | nº, fase, prazo, `seed_hash`, `seed` (revelada), `started_at` |
| `commands` | rodada × membro → lista de comandos (JSONB) |
| `snapshots` | rodada → mundo serializado (JSON + gzip, `bytea`) |
| `round_logs` | rodada → log de eventos das partidas + resumo do dia (JSONB) |

**`game_settings`** (editável pelo admin, vale a partir da próxima fase):

| Coluna | Default | Uso |
|---|---|---|
| `planning_timeout_s` | 180 | prazo da fase de planejamento no modo live |
| `halftime_timeout_s` | 30 | prazo do intervalo no modo live |
| `results_pause_s` | 15 | tempo na tela de resultados antes do próximo planejamento |
| `ms_per_minute` | 400 | velocidade da partida ao vivo |
| `daily_resolve_at` | `23:00` | horário de resolução no modo daily |
| `timezone` | `America/Sao_Paulo` | fuso do horário acima |
| `auto_ready_on_timeout` | `true` | quem não deu ready entra com o que tinha |

- Apagar um jogo é `DELETE FROM games` com `ON DELETE CASCADE` em tudo que pendura nele. Botão no painel do admin, com confirmação.
- Snapshots: manter os das últimas N rodadas e o de início de cada temporada; o resto pode ser reconstruído por replay (seeds + comandos ficam todos guardados). (`ponytail:` guardar todos até o tamanho incomodar.)
- Resolução em transação com `SELECT … FOR UPDATE` no `games`, para o agendador e o último "ready" não resolverem a mesma rodada duas vezes.
- Migrations com `drizzle-kit`, versionadas no repo, rodadas no start do deploy.

### 2.7 Ambientes

| Ambiente | Onde | Banco | Deploy |
|---|---|---|---|
| **local** | sua máquina, `pnpm dev` | Postgres do `docker-compose.yml` | — |
| **staging** | Railway, environment `staging` | Postgres próprio do Railway | push em `dev` |
| **prod** | Railway, environment `production` | Postgres próprio do Railway | push em `main` |

Tudo configurado por env var, mesmo código nos três:

```
# .env.example
APP_ENV=local                 # local | staging | prod
DATABASE_URL=postgres://bolasfoot:bolasfoot@localhost:5434/bolasfoot   # 5434: evita conflito com outros Postgres locais
SESSION_SECRET=troque-isto
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
TEST_ENDPOINTS=1              # libera rotas de teste (relógio, forçar prazo); nunca em prod
```

- `docker compose up -d` sobe o Postgres local; os testes de integração e E2E usam um banco separado (`bolasfoot_test`), criado pelo mesmo container.
- Scripts: `pnpm db:migrate`, `pnpm db:seed` (cria admin), `pnpm db:reset` (só se `APP_ENV=local`).
- Staging serve para jogar uma rodada de teste antes de promover para prod. Os dados de staging são descartáveis.

---

## 3. Harness de execução do jogo (runtime)

### 3.1 Unidade de jogo: "rodada"

O original avança **dia a dia** e para quando um humano precisa decidir (escalar para o jogo de hoje, responder proposta, aceitar emprego). No multiplayer, uma **rodada** é: avançar dias até o próximo dia em que *algum* humano tem jogo ou decisão pendente. Dias sem nada (salário, evolução, transferências da IA) são processados direto, sem parar.

Os modais do original (proposta recebida, oferta de emprego, pênalti) viram **itens de caixa de entrada** com prazo, respondidos na fase de planejamento. Sem resposta → padrão (recusar / batedor automático).

Jogar sozinho é só um jogo com um membro: ready imediato, sem esperar ninguém.

### 3.2 Máquina de estados

```
            ┌────────────────────────────────────────────────────────┐
            ▼                                                        │
  PLANEJAMENTO ──(todos ready OU prazo)──► RESOLUÇÃO ──► AO_VIVO_1T  │
  · baixa snapshot                         · trava comandos  │       │
  · edita escalação, mercado, etc.         · revela seed     ▼       │
  · ready / unready                        · aplica comandos INTERVALO (só modo live)
                                           · processa dias   │ · substituições/tática
                                           · simula 1º tempo ▼ · ready ou prazo
                                                        AO_VIVO_2T ──► RESULTADOS ┘
                                                     (simula 2º tempo com os ajustes)
```

Todos os prazos vêm de `game_settings`.

- **Modo live** (vocês numa call): prazos curtos, todos assistem juntos.
- **Modo daily:** mesma máquina, prazo = `daily_resolve_at`. Sem intervalo: o time humano usa as regras de substituição da IA (piloto automático, configurável na escalação). O próximo login mostra o **resumo** do que aconteceu desde a última visita (resultados, tabela, eventos do elenco, caixa de entrada).
- Os dois modos são o mesmo código; muda só o prazo e se o intervalo existe.
- Painel do admin: criar jogo (configuração da seção 3.5), gerar/revogar convites, editar `game_settings`, expulsar, pausar, forçar avanço, apagar o jogo.

### 3.3 Partida ao vivo sincronizada

O servidor **não faz tick**. Ele simula cada tempo inteiro em milissegundos e publica:

```
{ rodada, tempo: 1|2, startAt (relógio do servidor), msPorMinuto, eventos: [{min, partida, tipo, ...}] }
```

O cliente calcula `minutoAtual = (agora + offset − startAt) / msPorMinuto` e mostra placares e eventos até esse minuto. Todos ficam no mesmo minuto; quem entra atrasado cai no ponto certo. O offset de relógio vem na mensagem de boas-vindas do SSE.

- `ms_per_minute` padrão 400 → um tempo dura ~20 s (o original ia de 2000 a 100).
- Para o intervalo funcionar, o motor de partida é **segmentável**: `simular(estadoPartida, deMinuto, ateMinuto, rng)`. O estado (placar, energia, cartões, subs usadas) passa de um tempo para o outro.
- Pausa a qualquer momento (como no original) não existe no multiplayer; os pontos de intervenção são o intervalo. Depois dá para testar mais janelas (60', 75') se fizer falta.
- Pênalti com humano: o diálogo vira automático (fórmula de 70% com os modificadores), batedores definidos na escalação.

### 3.4 Mercado sem condição de corrida

- **Comandos privados** (escalação, tática, treino, ingresso, obras, juniores, empréstimo): só afetam o próprio time e são aplicados na resolução, na ordem enviada.
- **Comandos de mercado** (proposta por jogador): o cliente mostra na hora se a IA aceitaria (o preço de venda da IA é fórmula determinística), mas a compra só efetiva na resolução, como "transferência pendente" do original. Dois humanos no mesmo jogador → maior proposta vence; empate → quem enviou primeiro.
- Proposta de humano para humano: item na caixa de entrada do vendedor, responde na próxima fase de planejamento.
- Leilão: **nunca** aparece como tela no fim da partida (como no original). Há um botão "Leilões" que lista os leilões ativos; o lance é dado a qualquer momento do planejamento e o leilão encerra na resolução.

### 3.5 Criação do jogo e escolha de times

Não existe a tela "novo jogo" nem "adicionar técnico" do original. O fluxo é:

1. **Admin cria o jogo** e define toda a configuração (são as opções do original que sobram, mais as regras da escolha de times):
   - modo (`live` / `daily`), prazos (`game_settings`), habilidade individual, salário mensal/semanal etc.;
   - **regras de escolha de time:** times proibidos (lista), divisões permitidas (ex.: "só Série B"), e o que mais fizer sentido como filtro sobre o `base.json`.
   - **Fixo, sem opção:** temporada de início = a dos dados (sem seletor); estaduais e regionais sempre jogados; sem amistosos nem torneio de pré-temporada.
2. **Convite** → membros entram no lobby.
3. **Admin inicia o campeonato** → fase **escolha de times** (status `picking`, com prazo):
   - cada membro procura o time num **buscador** (nome, estado, divisão), não em pickers por divisão nem "time aleatório";
   - os filtros do admin já valem na busca; time pego por outro membro aparece como ocupado **em tempo real** (SSE);
   - escolheu → **ready**; todos ready (ou prazo) → o mundo é criado (`novoJogo`) e o jogo abre direto no hub do time.
   - Sozinho (um membro): mesma tela, sem o tempo real.
4. Preferências do original que são por jogador (velocidade, sons, cores) viram, quando fizerem sentido, configuração do admin ou do cliente; **cores e tema são fixos**.

---

## 4. Fases

Cada fase termina jogável ou testável. Os IDs servem para abrir sessões ("vamos fazer o M2").

### Fase 0 — Fundação — COMPLETE (2026-10-13)

| ID | Entrega |
|---|---|
| F0-1 | Monorepo pnpm: `apps/web` (Next vazio), `packages/engine`, `packages/data`; TypeScript strict, Vitest, ESLint mínimo, script `pnpm check` (typecheck + lint + test) |
| F0-2 | Ambientes: `docker-compose.yml` (Postgres + banco de teste), `.env.example`, leitura validada das env vars na subida do app |
| F0-3 | CI no GitHub Actions: `pnpm check` em todo push; Playwright só em PR para `main` |
| F0-4 | `packages/data`: ETL `teams/ligas/estaduais/options.jsonl` → `base.json` tipado (times BR + sul-americanos/estrangeiros usados nas continentais e no Mundial; espanhóis fora). Nomes/sobrenomes por país. Validação com contagens (196 BR etc.) |
| F0-5 | Script de assets: `original/game` + `original/res` → `apps/web/public/assets` com nomes estáveis |
| F0-6 | Referência visual: rodar o jar original (Java 8, `java -jar original/game.jar`) e capturar cada tela em `docs/ref/*.png`. É o gabarito da UI |

**Notas da entrega (F0):**
- **Base (`packages/data/base.json`, tipos em `packages/data/src/types.ts`):** 657 times = todos menos os espanhóis (não só os sul-americanos), porque o Mundial (`f/a_0.java:41-79`) só existe com os campeões das 6 confederações. Chave do time = `fileRef` (o `Id` do original repete). Países (224) vêm do enum `best/ac.java` com `nivel` (o `paisNivel` do `F.fI()`) e continente; UFs de `best/aq.java:555`. `potencial` = `Hash`, `craque` = `TopMundial` (falso em todos os dados), `estrela` em 20 jogadores. Juniores vêm em 85 times (1175).
- **Divisão BR não está nos dados:** é derivada no `novoJogo` ordenando por `Nivel` com desempate aleatório (`best/Z.java:112-228`). Hoje dá A = Nivel ≥ 16, B = 12–15, C = 10–11, D = 64 (empate sorteado no Nivel 7), resto divisão 0.
- **Postgres local na porta 5434.** O CI ainda não sobe Postgres (não há código de banco); entra como `services:` no job na S1 — o job `e2e` já aponta `DATABASE_URL` para `bolasfoot_test`.
- **Next 16 + TypeScript 6.0** (o typescript-eslint ainda não suporta o TS 7). `.env` fica na raiz e o `next.config.ts` carrega com `process.loadEnvFile`. Node 24 no CI.
- **Assets:** 4 nomes com acento vinham corrompidos pelo 7-Zip (bytes Latin-1 em U+EFxx); o `pnpm assets` corrige. 365 times não têm camisa própria (usar as genéricas por matiz da `cor1`); `audaxrj_bra` não tem escudo mini.
- **F0-6:** `tools/capture-ref.sh` roda o jar *dentro* de `tools/RefShots.java` (Java 17 com `--add-opens`), pilota a UI por um roteiro e desenha as janelas em PNG. 34 telas; faltam as que a versão grátis bloqueia ou que dependem de sorte/tempo (proposta, leilão, fim de temporada, demissão) — ver `docs/ref/README.md`.

### Fase 1 — Motor de partida (`packages/engine`) — COMPLETE (2026-10-13)

Tickets detalhados e decisões da fase: `docs/fase1.md`.

| ID | Entrega |
|---|---|
| M1 | RNG (`sfc32` + derivação + API estilo Java) e regra de lint de determinismo |
| M2 | Modelo do mundo (tipos serializáveis: Time, Jogador, Técnico, Competição, Calendário) + `novoJogo(base, opções, seed)` com a força `F.fI()` e a habilidade individual opcional |
| M3 | Partida: slots, formações, força de setores, loop por minuto, chute, tipo de gol, assistência, segmentação por tempo |
| M4 | Cartões, lesões, energia, substituições da IA, acréscimos, pênaltis, log de eventos (tipos 1–8 do original) |
| M5 | Pós-jogo: suspensões, duração de lesão, recuperação, notas, público e bilheteria |
| M6 | CLI `pnpm sim` que roda N partidas e imprime estatísticas (gols/jogo, % mandante, cartões, lesões) |

**Gate:** testes estatísticos batendo com o original (ver 6.2). ✔ `partida.stats.test.ts` contra o `ref-original.json` do oráculo.

**Notas da entrega (F1):**
- **API:** `novoJogo(base, opcoes, seed)` → `Mundo`; `escalarIA(mundo, time, competicao, rng)` → `Escalacao`; `iniciarPartida(mundo, [m, v], [escM, escV], ctx, rng)` → `Partida`; `simularTempo(p, 1|2, rng)` (segmentável: o intervalo é serializável); `substituir`/`mudarTatica` para o humano no intervalo; `aplicarPosJogo(mundo, p, rng)`, `recuperarEnergia(mundo)`, `publico(...)`. RNG por stream: `derivar(seed, 'partida:<id>:1T')`.
- **Oráculo:** `pnpm oracle [N]` (precisa de `original/` e Java 17) regenera a referência; `pnpm sim` imprime motor × original. Ver "Oráculo estatístico" no RE.
- **Ficou para depois (com `ponytail:` no código quando cabe):** contrato, valor e salário (W3); lista de transferências do `kp()` (W4); potencial de juvenil `ga/fZ` e notas/estatísticas de temporada (W5/W7); Série D pelos estaduais (W2); `B()` em seleções usa o lado, não o clube, e Copa do Mundo ×5 na renda (Fase 6); humano lesionado fica em campo até o intervalo (D2 decide o piloto automático).

**Notas vindas da F0:** o motor lê `Base` de `@bolasfoot/data` (não do jsonl). M2 implementa a derivação da divisão BR por `Nivel` (nota da F0). O `tools/RefShots.java` prova que o jogo original roda em processo, sem UI manual, no Java 17: isso torna o `tools/Oracle.java` da M6 (6.2) viável — chamar `c/b.java` direto ou rodar rodadas e ler o resultado.

### Fase 2 — Mundo, temporada e IA

Tickets detalhados e decisões da fase: `docs/fase2.md`. Primeira temporada em **2026** (o original usa 2022).

Começa fechando as **lacunas** listadas no fim de `engenharia-reversa.md`, cada uma como mini-tarefa de RE antes do port.

| ID | Entrega |
|---|---|
| W1 | Calendário anual (sequência de `best/a.java:249`), eventos de dia, `avançarDia` |
| W2 | Competições nacionais: Série A–D (incl. fórmula 1020 da C e grupos da D), Copa do Brasil (`best/Z.java`, `f/B.java`), estaduais (`f/o.java`, `best/w.java`), regionais |
| W3 | Economia: caixa, patrocínio, salários, prêmios, empréstimos, juros, estádio e obras, valor e salário de jogador, contratos e multa |
| W4 | Mercado: preço de venda da IA, propostas da IA pelos humanos, transferências entre IAs, leilão, juniores, empréstimos |
| W5 | Carreira: evolução semanal, treino, aposentadoria, juniores, reputação e pontos do técnico, satisfação da diretoria e torcida (`al.java:162-530`), demissão e ofertas de emprego |
| W6 | IA dos técnicos: escolha de escalação e formação, substituições, rodízio de técnicos, decisões de mercado — tudo extraído do Java |
| W7 | Fim de temporada: prêmios, acesso/rebaixamento, novo calendário, envelhecimento, histórico |
| W8 | `avançarRodada(mundo, comandos, seed)`: a função que a máquina de estados chama; comandos tipados e validados (`validar(mundo, técnico, comando)`) |

**Notas vindas da F0:** W1 — ao criar um jogo, o original imprime no stdout o calendário inteiro da temporada (`Nacional:1) 27/03/2022 Dom 85` etc.); rodar `tools/capture-ref.sh` e guardar a saída dá o gabarito de datas sem decifrar `best/a.java:249` no escuro. W2 — `base.ligas` (só BR) e `base.estaduais` (por `uf`) já estão tipados. Pelas decisões da 3.5: estaduais e regionais sempre ativos; amistosos (tipo 0) e torneio de pré-temporada (tipo 15) ficam fora do calendário.

**Notas da entrega (F2):**
- **W1:** `calendario.ts`, com datas absolutas (dias desde 1970) e a sequência `a.g()` inteira. Bate data a data com o original em 2022 e 2026 (`tools/calendario.sh <ano>` → `ref-calendario-<ano>.json`). `Mundo.dia` agora é absoluto e o `Mundo.calendario` é o da temporada corrente.
- **W2:** a parte genérica está em `competicoes.ts`: fase de liga/grupos, mata-mata, tabela, desempate, colocação final e o `avancarDia`. A parte do Brasil está em `brasil.ts`: as Séries A–D (C no formato 1020; D com os 64 que vêm dos estaduais, `w.Q`), os 18 estaduais (fórmulas 0–10 e os grupos reais do Paulistão), os regionais Nordeste e Verde (`jogaRegionaisTodos = [F,F,T,T]`) e a Copa do Brasil no formato novo (12 times entram na 3ª fase; os campeões do Nordeste e da Verde têm prioridade). Uma temporada só com IA joga 25 competições em cerca de 80 dias de jogo, em ~0,5 s.
  - **cD:** roda antes dos jogos do 1º dia de liga (correção na W3; ver RE "Pendentes").
  - **Ficou para depois:** os rebaixados da Série C entrarem direto na D, e as colocações do ano anterior nos regionais (W7). A tabela de jogos de grupo ímpar, de 6 em dois turnos e de 11 times usa o círculo com folga, não as tabelas fixas do `t.java`: muda a ordem dos jogos, não o formato. O `desempateEstadual` está em 0 em todos os estaduais e não foi portado. O humano escala pela IA até a W8. As vagas da Libertadores na Copa entram na Fase 6.
- **W3:** `economia.ts`.
  - Valor, salário e contrato do jogador (o mundo já nasce com eles).
  - Caixa só para os times humanos (`abrirCaixa`), com extrato da temporada.
  - Eventos de dia, que o `avancarDia` agora roda para todos os dias pulados: salário no dia 2 (só nos meses com jogo), juros e fim das obras.
  - Bilheteria do mandante humano; prêmios de liga, estadual, copa e regional.
  - Empréstimo (`pegarEmprestimo`/`pagarEmprestimo`) e obras do estádio (`orcamentoObra`/`iniciarObra`), com o bug do teto corrigido.
  - `receberPatrocinio` e `zerarExtrato` ficam prontos para a W7.
  - Numa temporada de teste, um time da Série A (folha de ~2M/mês) saiu de 15M para 28M; um da C, de 10M para 12,7M.
  - **Ficou para depois:** compra e venda (W4), juniores e o desconto do recém-promovido (W5), multa de rescisão (W4), satisfação da torcida no público (W5; hoje fixa em 85).

**Gate:** CLI simula 5 temporadas só com IA sem erro, com invariantes e estatísticas plausíveis (campeões variados, times grandes no topo na média, caixa dos humanos-piloto não explode).

### Fase 3 — Servidor, contas e jogos

| ID | Entrega |
|---|---|
| S1 | Schema Drizzle da seção 2.6 + migrations + `db:seed` do admin |
| S2 | Login/senha, sessão, convites (seção 2.4); telas de entrar, "tenho um código", criar conta |
| S3 | Painel do admin: criar jogo, convites, `game_settings`, expulsar, pausar, apagar |
| S4 | Lobby e escolha de times (seção 3.5): membros entram pelo convite, admin inicia, buscador de times com filtros do admin, picks em tempo real, ready, criação do mundo |
| S5 | Máquina de estados no servidor (`lib/game`): planejamento, ready, prazo, resolução transacional, commit-reveal, snapshots, agendador |
| S6 | SSE: canal por jogo (fase, prontos, prazo, eventos, relógio); reconexão com estado atual |
| S7 | Deploy no Railway: environments `staging` e `production`, Postgres por ambiente, migrations no start, assets servidos pelo próprio Next |

**Notas vindas da F0:** S1 adiciona o Postgres como `services:` no CI. A validação de env já existe (`apps/web/lib/env.ts`, chamada no `instrumentation.ts`); S7 só precisa setar as vars no Railway.

**Gate:** dois usuários criados por convite no staging avançam rodadas com uma UI crua (botão "pronto" + lista de resultados).

### Fase 4 — Front-end

UI **moderna, inspirada** no original, sobre o servidor da fase 3 (em local, com o Postgres do Docker).

**Diretrizes de UI:**
- `docs/ref/*.png` é **inspiração**, não gabarito: mostra quais informações cada tela tem e como o jogador está acostumado a achá-las. A disposição, o visual e os componentes podem (e devem) ser modernos.
- Mantém a "cara" do Brasfoot onde ela é identidade: escudos e camisas, nome do time com fundo `cor1`/texto `cor2` na tela de jogos, densidade alta de informação nas tabelas, partida com todos os jogos da rodada ao mesmo tempo.
- Paleta e tema **fixos** (sem seletor de cores de tela, sem cores do time editáveis, sem temas).
- Não portar: tela "novo jogo", "adicionar técnico humano", escolha de time por divisão / aleatória (ver 3.5), amistosos (agenda de amistosos, torneio de pré-temporada), leilão como tela pós-rodada, "cores da tela"/"cores do time", salvar/sair/registrar.
- Modais do original viram painéis, abas ou itens da caixa de entrada; nada bloqueante durante a partida.

| ID | Entrega |
|---|---|
| U1 | Casca: tokens da paleta (fixa), tipografia, componentes base modernos (tabela densa, navegação, painel/drawer, escudo, camisa, bandeira) |
| U2 | Tela inicial (seus jogos), criação do jogo pelo admin, lobby, escolha de times com buscador e picks ao vivo (3.5) |
| U3 | Hub do time (elenco + 11 ícones) e escalação (campo 434×650, 25 slots, estilo, marcação, batedores). Toque-no-jogador → toque-no-slot, que serve para mouse e celular sem lib de drag-and-drop |
| U4 | Partida ao vivo sincronizada (todos os jogos da rodada, eventos, sons), intervalo e resultados da rodada |
| U5 | Tabelas/classificação, agenda, histórico, técnicos, times |
| U6 | Finanças, estádio, ingresso, empréstimo |
| U7 | Mercado: procura, proposta, botão "Leilões" com os ativos e lance, juniores, treino (regras da seção 3.4) |
| U8 | Caixa de entrada (substitui os modais), fim de temporada, demissão/ofertas; barra de "quem está pronto" + contagem regressiva |

**Notas vindas da F0:** referência em `docs/ref/` (34 telas). Antes da U7/U8, capturar as que faltam (proposta, leilão, fim de temporada, demissão/emprego) estendendo `tools/capture-ref.txt`; a versão grátis bloqueia proposta. Assets em `apps/web/public/assets/` (nomes em `tools/assets.mjs`).

**Responsividade mínima:** layout desktop fixo (~1024 px) como o original; abaixo disso, tabelas com rolagem horizontal, barra de ícones vira barra inferior rolável, campo da escalação escala por `aspect-ratio`. Nada de redesenhar para mobile.

**Gate:** vocês jogam uma noite inteira no modo live, no prod, sem dessincronizar e sem abrir o console.

### Fase 5 — Modo daily

| ID | Entrega |
|---|---|
| D1 | Prazo por horário (`daily_resolve_at` + `timezone`), agendador resolve sozinho |
| D2 | Piloto automático do time humano (regras de substituição/escalação da IA, configuráveis) |
| D3 | Resumo no login (o que mudou desde a última visita) |

### Fase 6 — Competições internacionais e seleções

Libertadores, Sul-Americana, Recopa, Mundial de Clubes, Supercopa; ofertas de seleção, eliminatórias e Copa do Mundo. Times estrangeiros só como IA. Entra depois porque o jogo já é jogável sem elas e tem sorteios próprios a mapear.

**Notas vindas da F0:** todos os estrangeiros (menos ESP) já estão no `base.json`. A seleção dos participantes é por cota de país, não por flag no time (ver `engenharia-reversa.md`, "Dados e seleção de times").

### Fase 7 — Atualização de elencos por API

- `packages/data` ganha um importador que gera o **mesmo** `base.json` (contrato: `packages/data/src/types.ts`; `base.test.ts` valida contagens), então o motor não muda. Vale para jogos novos; jogos em andamento não mudam.
- Fonte: SofaScore não tem API oficial (instável, contra os termos); avaliar **API-Football** (tier grátis, ~100 req/dia, com cache local) ou dumps do Transfermarkt. Decidir no ticket.
- Mapear o que o Brasfoot precisa e a API não tem:
  - `Nivel` e `Reputacao` do time ← valor de mercado / ranking;
  - `Status` (titular) ← minutos jogados;
  - `Estrela`/craque ← nota média / valor;
  - `Cr1/Cr2` ← heurística a partir de estatísticas por posição;
  - escudos e cores ← API, com fallback para os do original.
- Script roda localmente, gera diff legível (entrou/saiu/mudou) para revisar antes de commitar.

### Fase 8 — Polimento

Sons, conquistas/troféus (72 PNGs), ajustes de balanceamento do multiplayer, arte própria aos poucos.

### Dependências

```
F0 ─► M1..M6 ─► W1..W8 ─► U1..U8 ─► D1..D3
 │                  ▲        ▲
 └─► S1..S7 ────────┴────────┘      Fase 6 depois de W; Fase 7 só depende de F0-4
```

A fase 3 (servidor) não depende do motor completo: pode correr em paralelo às fases 1–2 usando um `avançarRodada` falso. U1–U3 podem começar com um mundo só com a Série A.

---

## 5. Harness de desenvolvimento (como tocar as sessões)

### 5.1 Template de ticket

```
## <ID> — <título>
Objetivo: uma frase.
Fonte original: arquivos/linhas do Java (ou "n/a — mecânica nova do multiplayer").
Contrato: funções/tipos públicos que entram ou mudam.
Fora de escopo: o que fica para outro ticket.
Testes: quais (unitário / estatístico / golden / integração / e2e).
Pronto quando: `pnpm check` verde + critério do gate, se houver.
```

### 5.2 Fluxo de port de um módulo do motor

1. Ler o Java em `original/src` (lembrar dos `*_0.java` por colisão de maiúscula).
2. Se houver lacuna, atualizar `docs/engenharia-reversa.md` primeiro.
3. Portar linha a linha com nomes legíveis; cabeçalho com `// Fonte: best/F.java:538`.
4. Teste unitário dos casos com número fixo (ex.: força de um titular nível 20) + teste estatístico se tiver aleatoriedade.
5. Atualizar o golden (seção 6.3) se a mudança for intencional, citando no commit.

### 5.3 `CLAUDE.md` na raiz (criar na F0-1)

- Comandos: `docker compose up -d`, `pnpm dev`, `pnpm check`, `pnpm sim`, `pnpm db:migrate|seed|reset`, `pnpm e2e`.
- Regras: motor sem IO e sem aleatoriedade fora do RNG; citar fonte Java; não mexer em `original/`; nada de rota de teste fora de `TEST_ENDPOINTS=1`.
- Onde estão: plano, RE, referências visuais.

### 5.4 Branches

`dev` → staging, `main` → prod; um branch por ticket saindo de `dev`.

---

## 6. Testes

Poucos e objetivos. O que pesa no CI é só Playwright, e roda só em PR para `main`. O CI sobe um Postgres como service, igual ao Docker local.

### 6.1 Unitários (Vitest, `packages/engine`)

Fórmulas determinísticas com valores fixos: força, setores, preço, salário, público, prêmios, calendário (datas e dias da semana), tabelas de classificação e desempate.

### 6.2 Estatísticos (Vitest, mesma suíte)

Com seed fixa, simular 10k partidas (milissegundos) e checar faixas:

- ≈10% dos chutes viram gol entre times iguais;
- média de gols por jogo e vantagem do mandante dentro de faixa;
- distribuição dos tipos de gol (90/5/3/1/0.5%);
- cartões e lesões por jogo;
- duração das suspensões (70/20/7/2/1%).

Como a seed é fixa, o teste não fica intermitente. As faixas vêm das fórmulas do RE; se valer o esforço, um `tools/Oracle.java` que chama o motor original (`c/b.java`) sem a UI pode gerar os números de referência. Tentar na M6; se o acoplamento com Swing atrapalhar, ficar só nas faixas.

### 6.3 Golden (1 teste)

`novoJogo(base, opções, seed)` + 1 temporada com comandos gravados → hash do mundo final. Pega qualquer mudança não intencional de determinismo ou de regra. Atualizado conscientemente.

### 6.4 Integração (1–2 testes, `apps/web`, Postgres de teste)

- Convite → criar conta → login → entrar no jogo; convite revogado/esgotado é recusado.
- Máquina de estados: dois membros, comandos, ready, prazo vencido, resolução única mesmo com chamadas concorrentes, snapshot e log gravados, seed revelada confere com o hash.

### 6.5 E2E (Playwright, 3 testes)

1. **Live:** admin cria jogo e gera convite; segundo usuário (outro contexto de navegador) cria conta com o código; os dois dão ready, a partida toca e os dois veem o mesmo placar final.
2. **Daily:** prazo vence (relógio adiantado pela rota de teste) → resumo aparece no próximo acesso.
3. **Mobile smoke:** viewport de celular, abrir hub e escalação, trocar um jogador.

---

## 7. Riscos e decisões em aberto

| Tema | Risco / decisão | Encaminhamento |
|---|---|---|
| Lacunas do RE | Copa do Brasil, Série C, estaduais, calendário e IA de propostas ainda não mapeados | mini-RE no começo de cada ticket da fase 2 |
| Pausa durante a partida | Original permite a qualquer hora; multiplayer só no intervalo | testar na fase 4; adicionar janelas se fizer falta |
| Mercado simultâneo | Compra instantânea do original vira pendente até a resolução | aceito; prévia mostra se a IA aceitaria |
| Tamanho do snapshot | Mandar o mundo inteiro (gzip) para o cliente a cada rodada | medir na S5; diff só se passar de ~1 MB |
| Um processo só | Agendador e SSE em memória não escalam horizontalmente | irrelevante para o uso; Postgres `LISTEN/NOTIFY` se um dia precisar |
| Senha fraca | Sem regra de senha, por pedido | hash `scrypt` + rate limit no login; o site fica fechado atrás de convite |
| Direitos | Assets e dados do Brasfoot | repositório privado; site só com login |
| Fonte de dados atualizados | SofaScore sem API oficial | decidir na fase 7 |
