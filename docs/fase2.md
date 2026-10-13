# Fase 2 — Mundo, temporada e IA (tickets)

Detalhe dos tickets W1–W8 do `plano.md`. Fórmulas e mapeamento do Java em `engenharia-reversa.md` ("Mundo, calendário e temporada").

**Decisões da fase**
- **Primeira temporada em 2026** (o original começa em 2022, `f_0.rM`, que tem setter `I(ano)` usado pela tela de novo jogo). Temporada n = 2026 + n − 1, como em `f_0.java:1215`. O algoritmo de datas é o do original: só o dia da semana de cada data muda.
- **Datas são dias absolutos** (dias desde 1970-01-01), com aritmética própria, porque o motor não usa `Date`. `Mundo.dia` é absoluto e cresce sem parar de uma temporada para outra (lesões e suspensões não quebram na virada).
- **A sequência `a.g()` é portada inteira.** Tipos que não jogamos (amistosos 100/200, pré-temporada 15, internacionais 4–9 e 11–14) reservam a data, para que liga e copa caiam nas mesmas datas do original. Por enquanto só se jogam as competições BR: tipos 1, 2, 3 e 10. Os internacionais entram na Fase 6.
- **Estaduais e regionais sempre ativos** (plano §3.5). Por isso a Série D sai dos estaduais (`w.Q`) e a Copa do Brasil é montada no evento `cD`.
- **IA sem caixa, como no original.** A economia só é simulada para `humano`. O CLI do gate usa 1–2 humanos-piloto com escalação automática.

**Convenções:** as da Fase 1. O motor muta o `Mundo` recebido; RNG por stream (`derivar(seed, 'dia:<n>')`, `'partida:<id>:1T'`).

```
packages/engine/src/
  calendario.ts   W1
  competicoes.ts  W2 (genérico: fases, tabela, mata-mata, avancarDia)
  brasil.ts       W2 (Séries, estaduais, regionais, Copa do Brasil, evento cD)
  economia.ts     W3
  mercado.ts      W4
  carreira.ts     W5
  ia.ts           W6
  temporada.ts    W7
  rodada.ts       W8
tools/Calendario.java + calendario.sh   W1 (gabarito de datas)
```

---

## W1 — Calendário
Objetivo: as datas de cada competição da temporada, iguais às do original.
Fonte original: `best/a.java:222` (`b`: aloca o próximo dia livre com o dia da semana pedido), `:249-499` (`g`: a sequência), `:171` (`a(tipo, pula2)`: rodada k = k-ésima data); `best/f_0.java:1929` (`r`: um dia por data, dia corrente = 1º domingo de janeiro), `:1951` (`aS`: salário/juros no dia 2, evolução aos domingos).
Contrato: `ANO_INICIAL`, `TIPO`, `Calendario`, `criarCalendario(ano)`, `datas(c, tipo)`, `diaAbsoluto`, `data`, `diaDaSemana` (1 = domingo, como o Java), `formatarData`, `diaDePagamento`, `domingo`; `Mundo.calendario`, `Mundo.dia` absoluto.
Fora de escopo: `avancarDia` (W2, quando há partidas para jogar); eventos pós-jogo de `a.q()` (seleções → Fase 6; ofertas de emprego → W5; `cD` → W2).
Testes: golden contra `tools/calendario.sh 2022` e `2026` (todas as datas de todos os tipos), ida e volta de datas.

## W2 — Competições nacionais + `avancarDia`
Objetivo: uma temporada BR completa jogada só pela IA.
Fonte original: `f/t.java:746` (round-robin pelo círculo); `f/s.java:37-63, 632-663, 1199, 1303, 1351` (liga/grupos, turnos, acesso e rebaixamento); `f/z.java` (mata-mata); `f/b_0.java:76` (divisão nacional, Série C 1020); `f/f_0.java:46-286` (Copa do Brasil); `best/w.java` + `aq.java:776-836` (estaduais, fórmulas 0–10); `f/F.java` (regionais); `best/a.java:649-697` (`cD`); `h/k_0.java` (desempate); `best/f_0.java:1378-1694` (`ap/at/ax`: o dia).
Contrato: `Competicao` serializável (`fases`: `FaseLiga` | `FaseMataMata`, com os jogos já datados), `criarCompeticoesBR(mundo, base, rng)` (chamada no `novoJogo`), `jogosDoDia(mundo)`, `avancarDia(mundo, seed?)` (escala a IA → partidas → pós-jogo → recuperação → tabelas e próxima fase → evento cD → próximo dia de jogo), `classificacaoFinal(c)`.
Fora de escopo: dinheiro (W3), demissões (W5), acesso/rebaixamento aplicado (W7; aqui só a classificação final).
Testes: nº de rodadas e jogos por formato (A/B 38; C 19 + grupos + final; D 14 + mata-mata de 32; Copa); tabela e desempate com casos fixos; temporada inteira sem erro, determinística.

## W3 — Economia
Objetivo: caixa dos humanos e valores dos jogadores.
Fonte original: RE "Economia" (mini-RE no ticket: `F.java` valor/salário, `ah.java` caixa, `v_0.java` obras).
Contrato: `valorJogador`, `salarioJogador`, contrato e multa, caixa/patrocínio/salários/prêmios/empréstimo/juros/obras nos eventos do dia.
Corrigir: o teto da obra fica em `pa[1]` a partir da 2ª temporada.

## W4 — Mercado
Objetivo: transferências.
Fonte original: mini-RE (`kp()` da M2, `f_0.au/av`).
Contrato: preço de venda da IA, transferências entre IAs, propostas da IA pelos listados do humano, leilão, juniores, empréstimo.

## W5 — Carreira
Objetivo: os jogadores e os técnicos evoluem.
Fonte original: `F.java` (evolução `fV/fY`, aposentadoria), `ga/fZ` (potencial juvenil), `al.java:162-530` (diretoria/torcida), `ay.zw` (ofertas de emprego).
Contrato: evolução semanal no evento de domingo, aposentadoria, juniores, reputação, satisfação, demissão e ofertas.

## W6 — IA dos técnicos
Objetivo: técnicos da IA decidem como no original.
Fonte original: mini-RE (`ah.kh()`, rodízio de técnicos, decisões de mercado).

## W7 — Fim de temporada
Objetivo: virar o ano.
Fonte original: `best/f_0.java:524` (`aa`), `:1207` (`ah`: novo calendário), `:1303` (`am`), `best/Z.java:454-591` (`ee`: acesso/rebaixamento, troca com o pool), `best/w.java:265`.
Contrato: `fimDeTemporada(mundo, rng)`. Testes: golden de 1 temporada semeada (hash do mundo).

## W8 — `avancarRodada`
Objetivo: a função que a máquina de estados do servidor chama.
Fonte original: n/a (multiplayer; o "pare quando um humano decide" vem de `f_0.ay()`).
Contrato: `avancarRodada(mundo, comandos, seed)` avança dias até um humano ter jogo ou decisão; `validar(mundo, tecnico, comando)`.

**Gate:** `pnpm sim --temporadas 5` sem erro: campeões variados, posição média correlacionada com `Nivel`, caixa dos pilotos sob controle → `temporada.stats.test.ts`.
