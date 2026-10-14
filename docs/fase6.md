# Fase 6 — Competições internacionais de clubes (tickets)

Detalhe dos tickets I1–I6 do `plano.md`. Fórmulas e mapeamento do Java em `engenharia-reversa.md` ("Mundo, calendário e temporada").

**Decisões da fase**
- **Todas as confederações.** O Mundial (`f/a_0.java:67`) só existe com os campeões da Libertadores, da Champions, da CAF, da AFC, da Concacaf e da OFC. Por isso as continentais das 6 confederações são portadas. Fora da CONMEBOL o código é o mesmo, só mudam as cotas e os códigos de formato. Times estrangeiros jogam só como IA.
- **Sem Espanha** (decisão da F0). Ela aparece nas cotas da Champions, da Liga Europa e da Conference; essas vagas são completadas pelo `b.a()` (`f/b.java:27`), como o original faz quando faltam times.
- **Seleções ficam fora** e vão para a Fase 6B. Nesta fase entram só os tipos 4, 5, 6, 8, 11 e 12.
- **O calendário não muda.** As datas desses tipos já estão reservadas (W1). Hoje elas passam vazias porque não existe competição desses tipos.
- **O `cw` monta o Mundial;** não é um sorteio (`best/a.java:583,722-725` → `f/a_0.zC`). O único helper de sorteio é o `components.aq`.

**Convenções:** as da Fase 2.

```
packages/engine/src/
  internacional.ts  I1 (cotas, potes, sorteio, ganchos), I2, I3, I4
  competicoes.ts    I1 (classificados continental, gols fora, nome das fases, evento cw)
  brasil.ts         I2 (Libertadores na Copa do Brasil), I4 (Supercopa)
  temporada.ts      I1/I4 (f_0.ai → ae → Z na virada)
  economia.ts       I5
  carreira.ts       I5
apps/web/app/jogo/[id]/   I6
tools/Temporadas.java     gate (jogaIntClubes ligado)
```

---

## I1 — Infra internacional
Objetivo: criar uma continental genérica a partir de cotas por país, com potes, sorteio e as regras de mata-mata das continentais.
Fonte original: `f/b.java:14-39` (cotas e complemento); `best/Z.java:372-407` (`Z.a`: campeão da copa e depois Série A e B; `Z.je`: país sem liga, os 15 times em ordem, cada um sorteado com 85, 80 … 35 e depois 20%); `a_0.abm` (potes por força); `components.aq` (sorteio); `f/s.java:1040-1085` (fim dos grupos por `var0`); `f/g_0.java:320-410` (fim do mata-mata por `zf()`); `best/p_0.java:174-188` (criação no novo jogo, ordem w → r → v → u → t → y → H → x → j_0); `best/f_0.java:525-591` (`aa`: `ai` → `jw` → `ah` → `ae` → `Y` → `Z`).
Contrato: `internacional.ts` com `vagas(mundo, cotas, usados, rng)`, `potes`, `sortearGrupos`, `criarContinentais(mundo, base, rng)`, chamada no `novoJogo` e no `fimDeTemporada`. `Competicao` ganha `nomesFases?` (rótulo por fase e rodada, para a UI) e `confederacao?`. `classificados` ganha o ramo continental do `s.yP`.
Mini-RE: o que o `hD` tem no **1º ano** (as continentais nascem no novo jogo, antes de qualquer tabela); se os gols fora valem nas continentais (o comentário em `competicoes.ts:219` diz que sim, mas `golFora` está sempre `false`).
Fora de escopo: as competições em si (I2–I4).
Testes: unitário das cotas (país com liga, país sem liga, complemento quando faltam times); potes e sorteio determinísticos com seed fixa; mata-mata com gols fora, se valerem.

## I2 — Libertadores e Sul-Americana
Objetivo: as duas continentais da CONMEBOL completas, com o fluxo de times entre elas.
Fonte original: `f/r.java:48-83` (vagas: 28 direto e 19 nas preliminares), `:156-168` (detentor e campeão da Sul-Americana, com os fallbacks), `:239-315,483` (preliminares 4101/4102/4103), `:356-440` (grupos 8×4), `:442-481` (oitavas: 1º × 2º), `:362-363,454` (quem vai para a Sul-Americana), `:615` (sede da final); `f/H.java:49-79` (vagas, sem repetir a Libertadores), `o()` (grupos, só o 1º avança), `c()` (aviso); `best/Z.java:270-316` + `f/f_0.java:90-125` (12 reservados da Copa do Brasil).
Contrato: `criarLibertadores`, `criarSulAmericana`; os brasileiros da Libertadores entram na frente dos `reservados` da Copa do Brasil (fecha os `ponytail:` de `brasil.ts:254` e `temporada.ts:109`); `TipoAviso` ganha o aviso "caiu para a Sul-Americana".
Fora de escopo: prêmios e público (I5).
Testes: nº de jogos e rodadas de cada fase; os 4 eliminados da 3ª preliminar entram nos grupos da Sul-Americana e os 8 terceiros nas oitavas; nenhum time joga as duas desde o começo; uma temporada com IA termina as duas com campeão.

## I3 — Outras confederações
Objetivo: as continentais fora da CONMEBOL, jogadas só pela IA, para o Mundial ter os 6 campeões.
Fonte original: `f/v.java:53-119` (Champions, preliminares 4000–4004 e grupos 8×4), `f/x.java` (Liga Europa, 6001/6002/6005/6006), `f/j_0.java:57-116` (Conference), `f/t.java` (CAF, 8×4), `f/u.java` (AFC, 10×4, só o 1º avança), `f/w.java` (Concacaf, 8×3, só o 1º avança), `f/y.java` (OFC, 2×4); `best/f_0.java:1219-1235` (`ai`: campeão da Liga Europa → Champions, da Conference → Liga Europa, da Sul-Americana → Libertadores e Recopa).
Contrato: as tabelas de cotas e de formato no `internacional.ts`, sobre a I1.
Testes: uma temporada com IA termina as 7 com campeão e sem erro de "faltam datas"; o tempo por temporada continua na casa de 1 s.

## I4 — Mundial, Recopa e Supercopa
Objetivo: as competições que juntam os campeões.
Fonte original: `best/a.java:583,722-725` (`cw`), `f/a_0.java:41-79,146-160` (`zC`: quartas entre CAF, AFC, Concacaf e OFC, semis com os campeões da Libertadores e da Champions, final e 3º lugar, jogo único em campo neutro; `N()` grava os detentores); `f/e_0.java:29-47` + `f/d_0` (Recopa sul-americana e europeia, ida e volta; só da 2ª temporada em diante, `f_0.java:1018-1031`); `f/I.java:37-60` + `f_0.Z()` (`:499-523`; Supercopa: campeão da Série A × campeão da Copa, ou o vice da Copa se for o mesmo time, jogo único).
Contrato: evento `cw` no `avancarDia`, no mesmo molde do `eventoCD` (`competicoes.ts:521`); `Mundo` guarda os detentores por competição (feeds da Libertadores e da Recopa); `criarSupercopa` no `fimDeTemporada` (não depende do `jogaIntClubes`).
Fora de escopo: a Supercopa dos outros países (só o Brasil tem liga).
Testes: o Mundial acontece todo ano com 6 times; a Recopa não existe no 1º ano; Supercopa com o vice quando o campeão é o mesmo.

## I5 — Economia, carreira e resumo
Objetivo: as continentais pagam, dão reputação e aparecem no resumo da temporada.
Fonte original: `f/g_0.java:106-162,441` (prêmio por fase vencida, só humano); `aq.java:578-621` (`sw`: CONMEBOL 2M/3,5M/5M/20M/40M), `sy` (0,5M/1M/1,5M/5M/5M), `aeG`, `sx` ({2M, 5M, 7M}), `sz`/`sA` (Recopa e Supercopa: 1M); preliminares 500k (Libertadores) e 300k (Sul-Americana); `best/v_0.java:96-151,240` (público: +0,3 no tipo 4, +0,15 nos tipos 6, 8 e 11); `best/ah.java:793-1000` e `best/al.java:793-970,1063-1106` (reputação, pontos de carreira e diretoria).
Contrato: `premioFase` e `publico` cobrem os tipos 4, 5, 6, 8, 11 e 12; conferir o `carreira.ts` contra o Java; campeões internacionais no `resumoDaTemporada` (`rodada.ts:343`) e no `estatisticas.ts`.
Mini-RE: se o original abre leilão depois de dia de continental (`mercado.ts:584` hoje só abre depois dos tipos 1, 3 e 10).
Testes: unitário dos prêmios; numa temporada de teste, o caixa do piloto não explode.

## I6 — UI
Objetivo: o jogador acha e acompanha as continentais.
Fonte original: n/a (UI moderna; referência em `docs/ref/`).
Contrato: `etapaDoJogo` (`consultas.ts`) usa `nomesFases` quando existe ("Preliminar", "16-avos"…); `tabelas.tsx` e `historia.tsx` agrupam as competições em Nacionais, CONMEBOL e Outras confederações; `times.tsx` ganha filtro por país ou continente; o novo aviso entra na caixa de entrada.
Fora de escopo: troféus (Fase 8).
Testes: no navegador, um time da Série A joga uma rodada de Libertadores (hub, partida, tabela dos grupos, mata-mata com o nome certo da fase).

---

**Gate:** `pnpm sim --temporadas 10 --mundos 5` roda com as continentais sem erro, contra o `ref-temporadas.json` regenerado pelo `tools/temporadas.sh` com `jogaIntClubes` ligado e seleções desligadas. O `temporada.stats.test.ts` segue dentro das faixas. O Mundial acontece todo ano e a Libertadores tem campeões variados, com brasileiros e argentinos na frente. O golden do `temporada.test.ts` muda de propósito, citado no commit.
