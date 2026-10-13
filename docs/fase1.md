# Fase 1 — Motor de partida (tickets) — COMPLETE (2026-10-13)

Detalhe dos tickets M1–M6 do `plano.md`. Fórmulas em `engenharia-reversa.md`.

**Decisões da fase**
- Bugs das notas: os três são corrigidos (gol somado 2×, minutos jogados redefinidos por qualquer evento, pênalti perdido multiplicando o contador de gol contra).
- Habilidade individual entra já (M2 semeia, M3 usa no `B()`).
- Oráculo Java **estatístico** na M6 (bit a bit é inviável: ~270 `new Random()` sem seed no original).
- Toda partida tem acréscimo aleatório (caminho só-IA do original); a duração fixa da partida com humano era artefato da UI.
- `Técnico`, `Competição` e `Calendário` não entram na M2: a partida recebe um `ContextoPartida` mínimo; W1/W2 criam o resto.

**Convenções**
- O motor muta o objeto `Partida` recebido; quem chama clona o snapshot.
- Índice 0 = mandante, 1 = visitante (como no Java).
- `Math.round` do JS = Java (`floor(x+0.5)`): porta direto.

```
packages/engine/
  src/rng.ts         M1
  src/mundo.ts       M2 tipos, novoJogo, força, habilidades
  src/escalacao.ts   M2/M3 slots, formações, escalarIA
  src/partida.ts     M3+M4
  src/posjogo.ts     M5
  sim.ts             M6 CLI (fora de src/: pode fazer IO)
tools/Oracle.java    M6
```

---

## M1 — RNG e lint de determinismo
Objetivo: aleatoriedade reprodutível e proibição mecânica de fontes não determinísticas.
Fonte original: n/a (API imita `java.util.Random`: `nextInt`, `nextDouble`, `nextBoolean`; ponderado de `c/b.java:590`).
Contrato: `criarRng(seed)`, `derivar(seed, rótulo)`, `Rng { int, float, bool, shuffle, ponderado, estado, restaurar }`.
Lint: em `packages/engine/src/**`, proibidos `Math.random/pow/exp/log/sin/cos/tan/sqrt`, `Date`, `crypto`, `performance`, `process`, imports `node:*`.
Testes: vetor conhecido, reprodutibilidade, derivação independente, uniformidade de `int(n)`, estado/restaurar.

## M2 — Modelo do mundo + `novoJogo(base, opcoes, seed)`
Objetivo: mundo serializável com a força de cada jogador gerada como no original.
Fonte original: `best/F.java:538-682` (força), `:684-912` (habilidades), `:513-525` (subperfil), `best/Z.java:112-228` (divisão BR), `best/p_0.java:110-128` (carga: 15 por país sem liga), `best/ah.java:1315-1381` (time).
Contrato: `Mundo`, `TimeM`, `JogadorM`, `novoJogo`, `forcaInicial`, `habilidadesIniciais`.
Fora de escopo: contrato/valor/salário (W3), potencial de juvenil `ga/fZ` (W5), Série D (vem dos estaduais, W2).
Testes: força com RNG fixo, multiplicador por país, teto 100, juvenil, A/B/C = 20/20/20, determinismo.

## M3 — Partida: setores, tick, chute, gol
Objetivo: simular o jogo minuto a minuto, segmentável por tempo.
Fonte original: `c/b.java` inteiro; escalação da IA `best/ah.java:404-498, 626-683`; tabelas `best/aq.java:660-774`.
Contrato: `escalarIA`, `ContextoPartida`, `iniciarPartida`, `simularTempo(p, 1|2, rng)`, `valorJogo` (B).
Testes: setores com escalação fixa, `B()` com redutores, ≈9.8% de conversão entre times iguais, determinismo, segmentação (serializar no intervalo == contínuo).

## M4 — Cartões, lesões, energia, subs, acréscimos, pênaltis, eventos
Objetivo: completar o que acontece na partida.
Fonte original: `best/I.java:208-283` (minutos de sub), `:496-507` (amarelo), `:517-596` (incidentes), `:646-785` (eventos e reposição), `:787-877` (energia, subs), `:929-978` (vítimas), `:1036-1180` (acréscimos, pênaltis); `best/F.java:2116-2162` (lesão); `a/gb.java:98-184` (pênalti com humano); `a/bg_0.java` (disputa com humano).
Contrato: eventos `{tipo 1..8, tempo, minuto, lado, jogador, jogador2?, subtipo?, dias?}`; `substituir(p, lado, sai, entra)`, `mudarTatica`.
Corrigido: bug da lista de quem já entrou na sub tática da IA (`I.java` `n3 == 2`).
Testes: cartões/lesões/subs por jogo, tipos de gol 90/5/3/1/0.5%, mandante ≈57% na disputa só-IA, lesão com RNG fixo, sub inválida recusada.

## M5 — Pós-jogo
Objetivo: aplicar a partida ao mundo.
Fonte original: `best/f_0.java:1486-1525` (ordem), `best/h_0.java` (suspensão), `best/F.java:2165-2215` (cartões), `:2289-2482` (notas), `:363-403` (recuperação); `best/v_0.java:90-261` + `aq.qK` (público).
Contrato: `publico(mundo, partida, ctx, rng)`, `aplicarPosJogo(mundo, partida, ctx, rng)`, `recuperarEnergia(mundo)`.
Testes: notas fixas (goleiro, atacante com gol, reserva), público com preço automático e manual, gancho por vermelho, cumprir antes de lançar.

## M6 — `pnpm sim` + oráculo + gate
Objetivo: estatísticas do motor e comparação com o original.
Fonte original: `best/I.java:1036` (`V()`), carga `best/p_0.java`.
Contrato: `pnpm sim --n 10000 --seed x [--divisao 1]`; `tools/oracle.sh` → `packages/engine/src/ref-original.json`.
Testes: `partida.stats.test.ts` compara com o `ref-original.json` (tolerância por métrica).
Pronto quando: `pnpm check` verde com os estatísticos batendo (gate da fase).
