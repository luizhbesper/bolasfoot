# Brasfoot 22-23 — engenharia reversa

Referência para portar o jogo para o navegador com fidelidade. Para gerar `original/` (fora do git), rode `tools/extract.sh ~/Downloads/brasfoot22-23.exe`.

## Como o jogo é empacotado

- O `.exe` baixado é um instalador NSIS. Dentro dele estão o `bf22-23.exe` (um launcher Launch4j com um jar Java 8 Swing embutido) e os assets.
- O jar tem 1038 classes ofuscadas e usa Kryo 4.0.2 nos saves. O ponto de entrada é `best.h2`.
- As strings não são cifradas e os getters e setters mantêm nomes legíveis.
- **Pegadinha:** há classes cujos nomes diferem só por maiúscula/minúscula (`a.hU` e `a.hu`). No macOS é preciso decompilar com `--caseinsensitivefs`. Os arquivos que colidem viram `hu_0.java`; confira o cabeçalho "Renamed from".
- Os dados de times e configurações são Java serializado. `tools/Dump.java` os converte em JSON usando os getters.

## Dados extraídos (`original/data/*.jsonl`)

**Times:** 703 times de 134 países (196 do Brasil), com 14.672 jogadores e 1.175 juniores.

| Entidade | Campos |
|---|---|
| Time (`e.t`) | Nome, Estadio, Capacidade, Cor1/Cor2 (hex), Pais, Estado (UF), **Nivel** (6–20), **Reputacao** (0–5), Tecnico, TecNac, FileRef (nome dos arquivos de escudo e camisa) |
| Jogador (`e.g`) | Nome, Pais, Idade, Posicao (0 GOL, 1 LAT, 2 ZAG, 3 MEI, 4 ATA), Lado, Cr1/Cr2, Estrela, Status (1 = titular) |

- **O jogador não tem força salva.** A força é gerada no início do jogo (ver abaixo).
- Cr1/Cr2 são as características, por índice: 0 Col, 1 DPe, 2 Ref, 3 SGo, 4 Arm, 5 Cab, 6 Cru, 7 Des, 8 Dri, 9 Fin, 10 Mar, 11 Pas, 12 Res, 13 Vel.

**Ligas** (`ConfigLigaType`):

| Liga | Times | Rebaixados | Observação |
|---|---|---|---|
| BRA Série A | 20 | 4 | |
| BRA Série B | 20 | 4 | |
| BRA Série C | 20 | 4 | fórmula especial 1020 |
| BRA Série D | 64 | — | 8 grupos |
| ESP 1ª–4ª | 20 / 22 / 10 / 30 | — | |

A semântica de `doisTurnos` ainda não foi confirmada.

### Dados e seleção de times

- **Um time por linha** em `teams.jsonl` (703). O `Id` repete (282 times com Id 0); a chave é o `FileRef`, que também nomeia o `.ban`, o escudo e a camisa. O loader só aceita `Vid == 185` e `Valid` (`best/U.java:59`).
- **Campos de jogador sem nome óbvio:** `Hash` = potencial 0–10 (`F.java:531`; estrela com hash > 8 vira 10); `TopMundial` = craque (`F.java:2064`).
- **Juniores** ficam na lista `Juniores` do time (85 times, 1.175 jogadores), mesma classe `e.g`.
- **Países:** enum `best/ac.java:13-236` → `(P<idx>, CÓDIGO, idx, continente, nívelPaís, cores)`. Nome em `default_lang.xml` (`P<idx>`); continente 0 Europa, 1 Am. Sul, 2 África, 3 Ásia, 4 CONCACAF, 5 Oceania. `ac.fn(pais)` é o `paisNivel` do `F.fI()` e usa o país do **time**. Nomes/sobrenomes por código (`names/BRA.txt`).
- **Carga do mundo** (`best/p_0.java:51-128`): todos os `.ban` entram, ordenados por Nivel. Liga jogável exige ≥ 10 times no país (≥ 16 para ALE, ARG, ING, ITA, FRA) — só BRA e ESP. Países sem liga selecionada carregam os 15 primeiros por Nivel.
- **Divisão BR** não está nos dados: `Z.Ar()` (`best/Z.java:112-228`) ordena por Nivel com desempate aleatório (`hr = rand(1000)+1`, sorteado no construtor do time) e corta em blocos de `nTimes` (20/20/20/64). Sem estaduais, a Série D sai do Nivel 9, 8 e 1 sorteado do 7. **Com estaduais ligados (sempre, no port) a Série D não é formada aqui** (`Z.java:177`, `SR.e(true)`): vem dos estaduais. O resto fica na divisão 0.
- **Carga:** país sem liga selecionada carrega só os 15 primeiros por Nivel (`best/p_0.java:110-128`).
- **Continentais por cota de país** (`f/b.java:14-25` → `Z.a()`): Libertadores `f/r.java` (28 da fase de grupos + 19 da preliminar; BR 5+campeão da copa, ARG 5+1, outros 2 cada), Sul-Americana `f/H.java` (BR 6, ARG 6, outros 4 cada, sem repetir quem está na Libertadores). Faltando time, completa com outros países (`f/b.java:27-39`). O modo de grupos fixos (`aq.sP/sQ`) nunca é usado: cita FileRefs que não existem.
- **Recopa** só a partir da 2ª temporada (`best/f_0.java:1019-1023`). **Mundial** (`f/a_0.java:41-79`) só é criado se houver campeão das 6 confederações, por isso o port mantém todos os estrangeiros.
- **Extração:** o 7-Zip grava os bytes Latin-1 dos nomes de arquivo em U+EFxx (`puskás` → `pusks`); o `tools/assets.mjs` desfaz.
- **Rodando o original:** no Java 17 precisa de `--add-exports/--add-opens` de `java.desktop` (o jogo acessa `sun.java2d`); ver `tools/capture-ref.sh`. Ao criar um jogo ele imprime o calendário inteiro no stdout.

**Estaduais:** 25 UFs com até 4 divisões cada. Campos: `formula`, `nRebaixados`, `finaisIdaVolta`. As fórmulas estão implementadas em `f.o` e `best.w`, ainda não mapeadas.

**Outros recursos:**
- `res/arquivos/names|surnames/<PAIS>.txt`: geradores de nomes por país.
- `default_lang.xml`: só cerca de 268 strings (países, posições, competições). O resto da UI é português hardcoded nas classes.

## Força do jogador — `F.fI()` (`best/F.java:538`)

```
base,n6 = time em liga nacional ? {div1:(20,7) div2:(15,3) div3:(5,1) senão:(1,1)}
                                : {rep5:(22,7) rep4:(15,4) rep1-3:(5,1) rep0:(1,1)}
lvl = nivel<=15 ? nivel : {16:17,17:18,18:19,19:21,20:25,21:26,...25:30}[nivel]
f = lvl + base + rand(3)
status==1 (titular):  f += 8 + rand(2)
estrela/craque:       f += 9 + rand(3)
juvenil:              f -= 23; se f<5 → 10
paisNivel<=13: f *= (nivel<=5 ? .4 : nivel<10 ? .65 : .75)
senão nivel<3 ×.5 | <5 ×.6 | <10 ×.7
f = min(f,100)   // teto, não piso
```

- `n6` (segundo número da base) e `lvl−4` só alimentam a semeadura das habilidades.

- Existe a opção "habilidade individual". Com ela, 7 skills (Gol, Vel, Tec, Pas, Des, Arm, Fin) são semeadas por posição e característica, e cada slot as pondera de um jeito.

## Motor de partida — `c/b.java` + `best/I.java`

### Slots e formações

- O campo tem 25 slots (`aq.sE`):

| Slot | Posição |
|---|---|
| 1 | GOL |
| 2, 9 | LAT |
| 3–8 | ZAG |
| 10, 17 | alas |
| 11–16 | MEI |
| 18–25 | ATA |

- Jogador fora de posição vale ×0.5. O lado (`Lado`) é ignorado pelo motor.
- Há 12 formações (`aq.sJ`/`rB`): 5-4-1, 5-3-2, 4-5-1, 4-4-2, 4-4-2 def, 4-4-2 ofen, 4-3-3, 4-3-3 def, 3-5-2, 3-4-3, 4-2-3-1, 4-2-3-1 alas.
- A formação só importa por quais slots preenche.

### Valor do jogador no jogo e força dos setores

- `B(p) = força/10`, com penalidades por tipo de competição para times de reputação baixa.
- A energia **não** entra na força; só influencia substituições e notas.

```
meio  = (bônusMarcação{0,.04,.08} + ΣB(5 primeiros, slots 10..17)) / 5    (<3 jogadores → .01)
defesa=  ΣB(5 primeiros, slots 2..9) / 5                                    (<3 → .01)
ataque=  ΣB(3 primeiros, slots 19..25) / 3                                  (nenhum → 0)
goleiro= B(slot 1)   (nenhum → .1; goleiro fora de posição → round(g*.2))
```

### Loop por minuto (`vO`)

A posse alterna o lado que "tenta" a cada tick. O parâmetro `k` vale 11 da **5ª temporada** em diante e 8 antes; `kb` vale 10 e 8. (`a.SR.H()` é o nº da temporada, `f_0.java:1206`; o ramo `>=9 → 12` nunca roda.)

```
posse:  d2=1+(meio[A]-meio[B])/k; d3 = inverso; mandante +.3 (exceto comp 5/7); clamp .2
        vence ponderado {55*d2, 45*d3}
ataque: d4=1+(ataque[A]-defesa[B])/k; d5 = inverso; mandante +.3; ponderado {50*d4,50*d5}
        → chute, senão desarme/erro de passe (50/50)
chute:  d6=1+(goleiro[B]-B(chutador))/kb ; d7=1+(defesa[B]-ataque[A])/kb
        mandante: d6+=.1, d7=d6+.1 | visitante: d6-=.1, d7=d6-.1   (bug original: d7 sobrescrito)
        pesos {gol 5.5, defesa d6*35.55, fora d7*15}
        gols≥3 → 4.5 | ≥5 → 3 | ≥6 → .5 ; gols≥2 e rep adversário ≥ rep+2 → 3   (anti-goleada)
```

Com times iguais, cerca de 10% dos chutes viram gol.

**Quem chuta:** peso por slot. Zagueiro 1, ala 8, volante 4, meia 8, atacante 22. Somam-se +4 para Fin e +2 para Cab (+2 extra se for zagueiro).

**Tipo de gol** (rolagem de 1000):

| Faixa | Tipo |
|---|---|
| < 900 | normal |
| < 950 | pênalti |
| < 980 | falta |
| < 990 | contra |
| < 995 | olímpico |

- Se houver humano no jogo, o pênalti abre um diálogo próprio. A chance de gol começa em 70%:
  - batedor: +10 com Fin ou craque, +5 se estrela;
  - goleiro: −10 com DPe, −10 se craque, −5 se estrela.

**Assistência:** 20% dos gols não têm. Nos outros, o assistente é escolhido por pesos de slot e característica (Pas +10, Cru +5…). Com marcação pesada, os laterais ganham +20.

### Cartões, lesões e energia (`I.a`, estático, uma vez por minuto)

```
p = minuto<15?0 : <30?1 : 2 ; marc = {30,10,0}[marcação do lado punido]
1ºT: Y = {70,40,30}[p]+marc   R = {1200,900,800}[p]   J = {1500,1000,800}[p]
2ºT: Y = {45,40,30}[p]+marc   R = {800,700,550}[p]    J = {800,600,600}[p]
amarelos>5 → Y×2 ; vermelhos≥2 → Y=R*2 ; lesões≥1 → Y=J*5   (contadores da partida, dos dois times)
se rand(Y)==1 amarelo  senão se rand(R)==1 vermelho  senão se rand(J)==1 lesão
senão se 2ºT e minuto≥5: substituições da IA
```

- Os sorteios são **encadeados** (else-if) e os contadores sobem mesmo quando não se acha vítima.
- O lado punido é o mandante em 44% dos casos e o visitante em 56%.
- Eventos: 2º amarelo = tipo 3, vermelho direto = tipo 4 (a tabela de rótulos `aq.sT` está invertida).
- A vítima é sorteada por faixa de slots, com distribuições próprias para amarelo, vermelho e lesão.
- **Energia:** quando `minuto % 7 == 0` (inclusive o minuto 0) todos perdem energia (o goleiro só no 2º tempo). A perda depende da idade: até 20 anos −1, até 25 −2, até 31 −3, até 36 −4, acima −5. Piso 1.
- **IA:** 5 substituições, só no 2º tempo e no intervalo, com minutos sorteados antes do jogo (`I.java:208-283`; os não sorteados ficam −1). Trocas por cansaço (energia < 60, < 90 depois dos 40') e táticas quando está perdendo. No intervalo o mandante troca perdendo por 1, o visitante só perdendo por 2.
- **Acréscimos:** 1º tempo `rand(3)`, 2º tempo `rand(5)+1`, minutos a partir de 0. Só no caminho só-IA; partida com humano tinha duração fixa na UI (48/51 ticks). O port usa acréscimo em todas.
- **Não existe prorrogação.**
- **Pênaltis:**
  - jogos só da IA: placar sorteado, `a=rand(7)+2`;
  - com humano: cada cobrança entra com 70%, melhor de 5, depois morte súbita.
- **Tempo de cada tick** (ms), por velocidade escolhida:

| Jogo | Velocidades |
|---|---|
| com humano | 2000 / 1200 / 700 / 450 / 220 / 100 |
| só IA | 1200 / 700 / 300 / 100 / 70 / 30 |

- **Eventos:** 1 gol, 2 amarelo, 3 segundo amarelo, 4 vermelho, 5 lesão, 6 substituição, 7 pênalti perdido, 8 assistência.

### Pós-jogo

- **Gancho:** 3 amarelos (ao cumprir, zeram). Vermelho direto suspende 1/2/3/5/10 jogos com probabilidades 70/20/7/2.1/0.9%. A suspensão é cumprida antes de lançar os cartões da partida.
- **Lesão** (sorteada no momento do evento, `F.java:2116`): `rand(14)` dias + adicional por idade (≤20: 0; ≤25: +1; ≤30: +2; ≤35: +3; ≤45: +5+rand(20); acima +15+rand(20)) + energia (<10 → +5, <50 → +1; não vale para ≤20). 1% +70 dias, 3% +40, 6% +20. Jogador ≥35 perde 5 de força para sempre.
- **Recuperação de energia após a rodada:**

| Situação | até 20 | até 25 | até 31 | até 36 | acima |
|---|---|---|---|---|---|
| Jogou, time humano | +13 | +24 | +37 | +40 | +30 |
| Jogou, time da IA | +20 | +30 | +50 | +52 | +42 |
| Não jogou | <26: +30 | <45: +35 | acima: +30 | | |

"Jogou" = jogou desde o último domingo (a flag só limpa na evolução semanal).

- **Notas** (`F.java:2289-2482`): base por resultado e força, fora de posição −1.5, posse (meio), desarmes (defesa), goleiro por gols sofridos e chutes defendidos, gol +0.9, assistência +0.4, chute defendido +0.3, gol contra −1.5, amarelo −0.2, vermelho −0.8, estrela +0.4, craque +0.6; poucos minutos −2.5/−1.5. **Bugs do original, corrigidos no port:** gol normal/falta soma +0.9 duas vezes; qualquer evento (não só substituição) redefine os minutos jogados; pênalti perdido multiplica o contador de gol contra.

### Público e bilheteria (`best/v_0.java:90`)

- **Setores:** geral 15%, arquibancada 75%, cadeira 9% e camarote 0.9% da capacidade.
- Calculado antes da partida (`I.V()`). A renda só vai para mandante **humano** e nunca em comp 5/7 (`I.hf`).
- **Fórmula por setor:**
  - parte da demanda base por reputação (só ela; a divisão escolhe apenas a linha do ruído), de `{200,500,50,0}` (rep 0) a `{5000,40000,5500,500}` (rep 5);
  - ×0.7 em estadual/regional e ×0.4 em amistoso;
  - soma `capacidade×(0.3 + bônus da fase ou competição)`;
  - ±5% por nível de diferença de reputação com o visitante;
  - multiplica pela satisfação da torcida (`/100`; 80 sem técnico);
  - soma um ruído que depende da divisão;
  - aplica a elasticidade de preço: `+3% × (preçoPadrão − preço)`.
- **Multiplicadores da renda:** ×3 em copa de seleções, ×5 na Copa do Mundo, ×2 nas eliminatórias.
- Preço padrão na Série A: 10 / 15 / 25 / 80.

## Mundo, calendário e temporada (`best/f_0.java`, `best/a.java`)

### Tipos de competição

| Tipo | Competição |
|---|---|
| 0 | amistoso |
| 1 | liga nacional |
| 2 | copa nacional |
| 3 | estadual |
| 4 | continental 1 (Libertadores, Champions…) |
| 5 | Mundial de Clubes |
| 6 | continental 2 (Sul-Americana, Liga Europa) |
| 7 | copa de seleções / Copa do Mundo |
| 8 | Recopa |
| 9 | eliminatórias |
| 10 | regionais (Rio-SP, Sul-Minas, Nordeste, Verde) |
| 11 | Supercopa |
| 12 | Conference |
| 13 | Finalíssima |
| 14 | Liga das Nações |
| 15 | torneio de pré-temporada |

### Calendário (`best/a.java`, port em `packages/engine/src/calendario.ts`)

- **Dia:** `best.a` é um objeto por data. Guarda `Calendar p`, o tipo `w` (0 = livre; 100/200 = amistoso de clube/seleção), o flag de jogado `v`, os jogos `s`, as fases `t`, as competições `u` e duas listas de eventos: `q` (antes dos jogos) e `r` (depois).
- **Ano:** `f_0.r(ano)` (`f_0.java:1929`) cria um dia de 1/1 a 31/12. O dia corrente (`af`) começa no 1º domingo de janeiro. Ano-base `rM = 2022`, com setter `I(ano)` (`a/hU.java:199`). A temporada n usa `rM + n − 1` (`f_0.java:1215`), então o dia da semana de cada data muda de ano para ano.
- **Alocação:** `a.b(dow, tipo)` (`a.java:222`) parte do último dia que já tem tipo (o laço não olha o índice 0) ou do dia corrente, o que vier depois. Dali pega o 1º dia livre com aquele dia da semana (1 = domingo, como no Java). A sequência fixa é `a.g()` (`a.java:249-499`, 272 chamadas). Em 2022 e 2026 o port bate data a data com o `a.u()` do original (gabarito: `tools/calendario.sh <ano>`).
- **Datas por tipo (2026):**

| Tipo | Datas | Janela |
|---|---|---|
| liga | 54 | 29/03 a 24/12 (domingos; todo dia a partir de dezembro) |
| copa | 14 | |
| estadual | 23 | domingo, terça e quinta |
| regionais | 12 | |
| pré-temporada | 5 | |
| continental 1 | 23 | |
| continental 2 | 20 | |
| conference | 23 | |
| eliminatórias | 28 | |
| Copa do Mundo | 8 | |
| Mundial | 3 | |

- **Rodada → data:** `a.a(tipo, pulaDuas)` (`a.java:171`) lista em ordem as datas ainda não jogadas de um tipo. A rodada k vai na k-ésima delas (`f/s.java:676-688`).
- **Eventos de dia** (`f_0.aS`, `f_0.java:1951`):

| Código | Evento | Quando |
|---|---|---|
| `ds` | salário | dia 2 de cada mês (salário mensal) ou todo domingo |
| `dJ` | juros do empréstimo | dia 2 de cada mês |
| `aj` | evolução semanal (`f_0.aT`) | domingo |

- **Eventos pós-jogo** (`a.q()`, `a.java:735`):

| Código | Evento | Quando |
|---|---|---|
| `cS` | convites de seleção | após a 4ª rodada do estadual, no 1º dia de seleções e nas rodadas 12 e 18 da liga |
| `cSempregado` | convites de seleção para técnico empregado | após a rodada 1 da liga |
| `cO` | convocação | 1º dia de seleções |
| `cPromocao` | ofertas de emprego (`ay.zw`) | após a rodada 20 da liga |
| `cD` | monta Copa do Brasil e Série D a partir de estaduais e regionais | 1º dia de liga |
| `cw` | monta o Mundial (`f/a_0.zC`; não é sorteio) | antes do último dia de continental 1 |

- **Pendentes:** o jogo só para em dia de jogo. Depois dos jogos do dia D, `q(0)` roda os eventos de dia (`ds`, `dJ`, `aj`) de todos os dias até D. Em seguida `az()` avança para o próximo dia de jogo D′, e `q(1)` roda os eventos pós-jogo de todos os dias até D′. Por isso o `cD` do 1º dia de liga roda **antes** dos jogos desse dia: a Série D e a Copa já começam nele, com a tabela das séries ainda zerada. A troca de nome é do decompilador: `r()` devolve a lista `q`, e `s()` a lista `r`.
- Torneios de seleções seguem ciclos de 2 ou 4 anos.

### Avançar o dia (`f_0.ap` → `at` → `ax`)

- **`ap()`** (`f_0.java:1378`):
  - `ay()`: se um humano que joga hoje não escalou, abre a escalação dele (**esse é o hot-seat**).
  - `ah.kh()`: escalações da IA.
  - `I.he()`: prepara as partidas.
  - `I.V()`: simula.
- **`at()`** (1531):
  - `as()`: pós-jogo por partida (`hg` contratos/empréstimos, `hi` suspensões, `hf` bilheteria do humano mandante, `hh` estatísticas).
  - `an()`: avisa a associação (`Z.a(s)`).
  - `aM()`: marca os dias jogados.
  - `aC()`: `pO()` de cada fase jogada atualiza a tabela e abre a próxima fase.
  - `aB()`: limpeza.
  - `q(0)`: eventos de antes dos jogos.
- **`ax()`** (1635):
  - Em dia de liga ou estadual, `n(tipo)`: demissões da IA e ofertas a humanos desempregados.
  - `az()`: avança para o próximo dia de jogo.
  - `au()`: transferências pendentes.
  - Com 50% de chance, `av()`: a IA faz propostas pelos jogadores que os humanos listaram.
  - `aw()`: obras do estádio.
  - `q(1)`: eventos pós-jogo.
  - Sem próximo dia → `aa()`, fim de temporada.

### Competições (modelo)

- **Classes:** `best.at` (abstrata: tipo `tR`, país/estado `dz`, campeões `tT`), `best.l_0` (fase), `f.s` (liga/grupos), `f.z` (mata-mata), `f.b_0` (divisão nacional), `f.o` (divisão estadual), `f.f_0` (Copa do Brasil).
- **Correção:** `f/B.java` é o helper de vagas internacionais por país, não a classe da competição. No macOS ele colide com `f/b.java`.
- **`f.s`:** times `Zb` (é também a tabela), grupos `Za`, mata-mata seguinte `Zc`, quantos avançam `Zd`, nº de grupos `Zj`, `doisTurnos`, código de formato `var0`, rodada `Zf` / `Ze`.
- **Tabela de jogos** (`t.a`, `t.java:746`): método do círculo.
  - Embaralha os times; com número ímpar, um folga.
  - Intercala rodadas pares e ímpares e inverte o mando na mesa 0 nas rodadas ímpares.
  - O returno espelha o turno com o mando trocado.
- **Turnos da liga (tipo 1)** (`s.java:632-663`):
  - Sempre dois turnos, menos com 26, 28, 30 ou 36 times. O `doisTurnos` é ignorado em liga nacional.
  - 20 times com `var0` 1020: turno único.
  - 8 times: 4 turnos. 10 times: 4 (ou `numeroTurnos`). 12 ou 14 times: 3 (ou 2).
- **Pontos e desempate:**
  - Vitória 3, empate 1 (`ah.java:1101`).
  - Linha da tabela `[pts, J, V, D, E, GP, GC, SG]` (`ak.java:47`).
  - Desempate (`h/k_0`, `a_0.abn`): pontos → vitórias → saldo → gols pró. O `desempateEstadual` usa outro comparador (mapear na W2).

### Formatos BR

- **Divisões:** `Z.Ar()` (`Z.java:112`) monta até 4, a partir de `ligas.jsonl`.
- **Série A e B:** 20 times, dois turnos (38 rodadas), 4 rebaixados.
- **Série C** (`numeroTimesMataMata` 1020):
  - 20 times em turno único (19 rodadas). Avançam 8 (`s.java:443`).
  - 2 grupos de 4: {2º, 7º, 4º, 5º} e {1º, 8º, 3º, 6º}, em dois turnos (`b_0.java:76`, `var0` 1022).
  - Os líderes dos grupos fazem a final.
  - Sobem: campeão, vice e os melhores segundos (`s.java:1199`).
- **Série D:**
  - 64 times, 8 grupos de 8, dois turnos (14 rodadas).
  - Os 4 primeiros de cada grupo (32) vão a um mata-mata de jogo único, chaveado por `Zy`.
  - Os 4 promovidos vêm das últimas fases (na prática, os semifinalistas).
  - Com estaduais ativos, começa vazia (`Z.java:177`). No `cD` é preenchida por `w.Q(n)` (`a.java:659`): as melhores colocações nos estaduais, na ordem de prioridade dos estados `aq.sb..sf` (`aq.java:559-569`).
- **Copa do Brasil** (`f/f_0.java`):
  - **Formato antigo** (`a`, :46): maior potência de 2 até 128 times; metade de cima contra a de baixo; ida e volta.
  - **Formato novo** (`b`, :86; 91 ou mais times e `novoFormatoCopa`):
    - 12 entram depois: os da Libertadores e os cabeças de chave, com prioridade aos campeões regionais (`Bg`).
    - Fase 1: os outros 80, em 8 potes de 10, jogo único.
    - Fase 2: os 40 vencedores, top 20 × bottom 20, jogo único.
    - Fase 3: os 20 + os 12, em 32 times chaveados 16 × 16, ida e volta.
    - Depois: 16, 8, 4 e 2 times, sorteio livre, ida e volta (:256-286).
- **Estaduais** (`best/w.java`):
  - Existe estadual em todo estado com 6 ou mais times (`w.java:170`), com até 4 divisões (`f.o`, tipo 3). A configuração por estado vem de `conf_estadual/*.ces` (`w.java:366`).
  - Fórmulas 0–10 (`aq.sL`, `aq.java:776-836`):

| Fórmula | Times | Grupos | Vão ao mata-mata | Dois turnos | Rebaixados |
|---|---|---|---|---|---|
| 0 | 6 | 0 | 2 | sim | 2 |
| 1 | 8 | 0 | 4 | sim | 2 |
| 2 | 10 | 0 | 4 | não | 2 |
| 3 | 11 | 0 | 4 | não | 2 |
| 4 | 12 | 0 | 4 | não | 2 |
| 5 | 12 | 0 | 8 | não | 2 |
| 6 | 14 | 0 | 8 | não | 2 |
| 7 | 16 | 4 | 2 | não | 2 |
| 8 | 16 | 0 | 4 | não | 2 |
| 9 | 16 | 0 | 8 | não | 2 |
| 10 | 20 | 4 | 2 | não | 4 |

  - Nas fórmulas 7 e 10, os grupos jogam contra os outros grupos (`jogosDentroGrupo` falso).
  - As colocações finais vão para `SR.bx()` (`s.java:1576-1627`), que alimenta Série D e Copa.
- **Regionais** (`f/F.java`, tipo 10):
  - Quatro regiões: RJ/SP; MG/PR/RS/SC; Nordeste; resto ("Verde") (`F.java:52`, `p_0.java:199`).
  - Só existe com 16 ou mais times.
  - 4 grupos de 4 (potes `a_0.ad(4,4)`), dois turnos; os 2 primeiros vão às quartas. Quartas, semi e final em ida e volta. São 12 datas, que batem com as 12 datas de regional.

### Fim de temporada (`f_0.aa`, `f_0.java:524`, port em `packages/engine/src/temporada.ts`)

Ordem do `aa()` (os passos internacionais e de seleções ficam para a Fase 6):

| Passo | Original | O que faz |
|---|---|---|
| 1 | `ah.kI` → `C.eA` | zera o extrato dos humanos |
| 2 | `ah()` (:1207) | temporada + 1, calendário do ano novo (`r` + `a.g()`) |
| 3 | `ag()` (:1184) | reputação do time (`ah.kk`); na IA, lista de sobras (`kp`), elenco por força (`kA`, batedor de falta) e depois por força e idade (`kz`, `ai`); +50 de diretoria e torcida do técnico (`al.cj/ck`); patrocínio dos humanos (`kG`, pela divisão velha) |
| 4 | `iZ()` | reputação dos técnicos (`al.kk`) |
| 5 | `Y()` → `Z.y(true)` | os 12 que entram direto na 3ª fase da próxima Copa: Série A e B pela colocação, campeão da B e campeão da Copa na frente (`f_0.afU`) |
| 6 | `Z()` → `f.I.Ab` | Supercopa (tipo 11): Fase 6 |
| 7 | `am()` → `Z.ee` (:454) | acesso e rebaixamento nacional |
| 8 | `ak()` → `w.ee` (:265) | acesso e rebaixamento estadual |
| 9 | `aj()` → `F.am` | regionais do ano novo pela ordem das séries (`p_0.di`) |
| 10 | `af()` (:1057) | aniversário, aposentadoria, juniores de 20 anos (`gd`, `gf`) e juniores novos (`c(true)`: quem tem < 15 ganha n+1, n = 2..4 na liga nacional, 0..2 (+1 com Nivel ≥ 20) fora) |
| 11 | `W()` (`H() ≥ 5`) | transferências com mais de 10 anos saem do histórico (`SR.bo`) |
| 12 | `ay.zi/zj` | tabelas de propostas de emprego (o port calcula na hora) |
| 13 | `ag.jO`, `ag.jQ` | janela da IA e demissões de fim de temporada |

- **Quem sobe** (`s.l(n, true)`, `s.java:1185`): o decompilador perde o ramo do mata-mata; lido do bytecode (`javap -c -p -cp original/game.jar f.s`).
  - Sem mata-mata: os n primeiros da tabela.
  - Formato 1020 (Série C): campeão e vice da final, depois **todos** os segundos dos grupos (pelo `abn`), e só então o resto dos grupos.
  - Com mata-mata: os vencedores de cada rodada, da última para a primeira, até n; depois a tabela. Na Série D, isso dá campeão, vice e os outros dois semifinalistas.
  - O playoff de acesso (`b_0.BR`, `vagasSobemPeloMataMata`) é 0 em todas as séries BR.
- **Quem cai** (`s.fG`, `s.java:1303`): os n últimos da 1ª fase, do último para cima. Por grupo só com `rebaixadoPeloGrupo` **e** grupos na 1ª fase, o que nenhuma série BR tem. Nos estaduais o `zc()` é sempre falso.
- **Troca** (`Z.ee`): a divisão i perde `fG(nRebaixados(i))` e ganha `l(nRebaixados(i))` da divisão i + 1, só se as listas têm o mesmo tamanho; `ah.b(at, 0|1)` marca no histórico do time. Os rebaixados da Série C vão para `SR.bY` e entram primeiro na Série D seguinte (`w.Q`). Com estaduais, a Série D inteira volta ao pool (`s.yJ`, `Z.java:591`).
- **Estaduais** (`w.ee`): a mesma troca entre divisões; a última troca com a fila do estado (`w.dt`): saem os primeiros da fila, os rebaixados vão para o fim.
- **Hall da fama** (`F.java:1714`, `best.b_0`): ao se aposentar, entra quem tem mais de 0/10/30/50 gols na carreira (temporada < 2/< 10/< 20/depois). Gols (`F.fh`) e jogos (`F.fi`) contam em `I.hh` (titulares e quem entrou; gol contra não conta).

## Economia (port em `packages/engine/src/economia.ts`)

- **Só os times humanos têm dinheiro simulado.** O original dá caixa a todos (`kH`), mas a IA nunca gasta.
- **Caixa inicial** (`aq.sC`): 15M / 12M / 10M / 3,5M nas Séries A a D, e 3,5M fora delas. É definido quando o humano assume o time (`ah.lg` → `kH`).
- **Patrocínio anual** (`aq.sD`): 6M / 4,5M / 2,5M / 2M; fora das séries, 3,5M.
  - O do 1º ano só entra no extrato: já está contado no caixa inicial.
  - A partir daí é pago na virada da temporada (`kG`, `f_0.java:1202`).
  - Estrangeiro com estaduais ligados recebe ainda +3,2 folhas.
- **Extrato da temporada** (`best/C.java`):

| Código | Receita | Código | Despesa |
|---|---|---|---|
| 1 | vendas | 1 | compras |
| 3 | prêmios | 4 | juros |
| 5 | bilheteria | 7 | obras |
| 6 | patrocínio | 8 | comissões |
| 9 | multas aos jogadores (`a/bn_0.java:103`) | | salários (lançados à parte, `b()`) |

- **Salário** (`ds`, `a.n`): no dia 2 de cada mês (ou todo domingo, com salário semanal), mas só se o time **tem jogo marcado naquele mês** (`ah.bY`). Valor = soma do elenco e dos juniores (`kK`).
- **Empréstimo** (`C.l/m`):
  - Blocos de 500 mil, até 5M / 3M / 2M / 1,5M nas Séries A a D, ou 1M fora delas.
  - Devolve 500 mil se houver caixa.
  - Juros = `floor(saldo × 3 / 100)`, cobrados no dia 2 (`dJ`, `a.o`).
  - **Desvio no port**: contratos parcelados (tabela Price) em 6, 12, 24 ou 36 vezes, valor livre em passos de 100 mil; limite = 30% do valor do elenco (mínimo 500 mil) somando os saldos; juros ao mês = 1% + 6% × (dívida com o novo / limite) + 3% × (prazo − 6) / 30, de 1% a 10%; parcela no dia 2; quitação antecipada paga só o saldo.
- **Bilheteria** (`I.hf`): só para o mandante humano, nunca no Mundial nem em jogo de seleções. O público vem de `v_0` (ver acima).
- **Prêmios** (só humanos):

| Competição | Fonte | Valores |
|---|---|---|
| Liga, por colocação | `aq.sr`, `ah.c` | A 5M / 3,5M / 2M / 1,5M / 1M / 0,5M; B 2,5M a 100k; C 1,5M a 75k; D 750k a 50k |
| Estadual da 1ª divisão | `su` | 700k / 500k / 300k / 100k |
| Copa nacional, por fase vencida | `ss`, `g_0.c/V` | `ss[fase + 8 − nFases]`, de 1M a 25M (a final paga 25M) |
| Regionais, por fase do mata-mata | `sv` | 100k / 100k / 400k |

- **Valor do jogador** (`F.fK`):
  - Fórmula: `(2·força)² × mult`.
  - Base do mult pelo Nivel do time: ≥21 → 750, ≥20 → 600, ≥18 → 500, ≥12 → 400, senão 366.
  - Estrela: ×3 (Nivel ≥22, país europeu), ×2 (≥21, europeu), ou ×1,7. Craque ×1,6. Atacante ×1,3. Titular +20%.
  - Idade: <20 → +(32−i)·27; ≤25 → +(32−i)·22; <32 → +(32−i)·15; <34 → +(34−i)·10; senão −(i−34)·50. Se o mult ficar ≤ 0, vale 60.
  - Juvenil: `round(v·0,03) × potencial` (×1,5 com potencial 10).
- **Salário do jogador** (`F.fJ`):
  - Base por divisão: 600 / 500 / 450 / 400, ou 750 / 550 / 500 / 450 nos países `aq.rW`; fora das séries, 350. +50 se Nivel > 20.
  - Por posição: GOL −70, LAT −30, ZAG −40, ATA −50.
  - Fórmula: `força·2·round(base/2)`; +força·250 para estrela. A partir de 32 anos, −(i−32)·300.
  - Piso 500. Craque ×1,4; juvenil ×0,1. ×4 se o salário é mensal.
- **Contrato:** 210 a 239 dias na criação do mundo (`F.fI`); 180 dias para o juvenil promovido (`k_0`). Valor e salário são recalculados na virada da temporada (`f_0.af`).
- **Estádio** (`a/cq_0`, `f_0.aw`):
  - Custo = 100 mil + Σ lugares × preço da faixa da capacidade final:

| Setor | Faixas (até) | Preço por lugar |
|---|---|---|
| geral | 1000 / 2500 / 3500 / 10000 / 18000 | 80 / 160 / 240 / 500 / 700 |
| arquibancada | 5k / 15k / 30k / 60k / 80k | 120 / 380 / 640 / 700 / 1400 |
| cadeira | 1k / 2k / 3k / 5k / 9k | 300 / 600 / 750 / 800 / 1200 |
| camarote | 100 / 200 / 500 / 600 / 700 | 1500 / 3500 / 4000 / 6000 / 6400 |

  - Pago à vista. Prazo: <1000 lugares → 15 dias, <10 mil → 20, <30 mil → 30, senão 40. A obra termina no 1º dia de jogo depois do prazo.
  - Teto por setor `aq.pa`: o original testa `H >= 2` antes de `>= 6` e `>= 10`, então o teto real fica em `pa[1]` a partir da 2ª temporada. **Corrigido no port.**
  - **Desvios do port:** custo × 3 e prazo × 2 (`MULT_OBRA`, `economia.ts`), uma reforma por temporada e histórico das reformas em `Financas.obras`.
- **Preço de venda da IA** (`l.java:578`), pelos jogadores do vendedor na posição (sem os emprestados):

| Situação | GOL / LAT / ZAG / MEI | ATA |
|---|---|---|
| Tem pelo menos 3/4/4/5/4 | +50% / +20% / +20% / +20% | +50% |
| …e o jogador tem força < 30 ou mais de 35 anos | −15% / −20% / −20% / −10% | −10% |
| Tem só um | ×2,5 | ×3 |
| Demais casos | ×2 | ×2,5 |

- **Elenco:** no máximo 35 jogadores.
- **Contratos:** 180 dias, ou 365 dias em empréstimo.
  - Multa de rescisão (`F.java:2566`), paga pelo vendedor humano só na venda pela lista ou imediata: 12% / 20% / 22% / 25% / 30% do preço com até 30 / 60 / 90 / 180 / mais dias de contrato.
  - Renovação (`a/fy_0`): 180/365/730/1095 dias somados ao fim atual. Salário até 25% do valor; o mínimo aceito é o salário −1/3/5/12% (faltando menos de 60 dias) ou +10/12/15/5%.

## Mercado (W4)

Campos do `F`: `ff()` estrela, `gm()` craque, `status == 1` titular, `gl()` emprestado, `ft()` à venda, `fz()` para empréstimo, `fl()` preço pedido, `eZ` time anterior (a IA não recompra).

- **Lista da IA** (`ah.kp`, na criação do mundo e no começo da temporada): embaralha o elenco; em cada posição com mais de 2/3/3/5/4, 50% de chance de listar o 1º reserva que não é estrela, craque nem emprestado, pelo valor. 30% desses, se a força for < 42, também ficam para empréstimo.
- **Quem compra** (`best/l`): um time da IA que "quer" o jogador (`ah.a`: elenco < 35, força entre o mínimo da divisão/reputação `aq.qg/qh` e o máximo da reputação `aq.qi`; se o vendedor é da IA, sem excesso na posição).
  - Ordem da busca: times da liga BR na faixa de divisões do vendedor (±1; força ≤ 20 em qualquer uma), depois times de fora das ligas nacionais (do país do jogador, se ele é sul-americano ou do continente 4 e com 85%; senão do continente do vendedor). Na venda pedida, a partir da 3ª temporada e abaixo do valor, qualquer time.
  - Craque vai primeiro para um grande da Europa. Estrela, ou força > 30 com 40%, de humano pula a liga BR.
  - As listas de ligas europeias do original ficam vazias no port (sem a Espanha não há liga na Europa).
- **O jogador aceita?** (`l.c/d`): destino europeu sempre. De um europeu de reputação ≥ 4: só para reputação ≥ 4 ou Série A; reputação 3 pede o salário dobrado. Senão recusa só um time de reputação ≥ 4 indo para ≤ 2, ou de reputação 3 indo para 0.
- **Proposta do humano** (`a/cz_0`): listado com oferta ≥ preço pedido sai pelo preço pedido. Senão, oferta ≥ preço da IA fecha (ou pede o salário dobrado); abaixo, contraproposta pelo preço da IA se o humano tem esse caixa. Depois da compra, a IA repõe cada posição abaixo de 2/3/3/5/3 com um jogador de força ±5 **da posição do vendido** (bug do original, mantido) de um time de reputação parecida com sobra.
- **Venda pelo humano:** pela lista, a IA compra depois de cada dia de jogo com 50% (`f_0.av`); imediata (`a/jc.dE`), aceita até 10–15% abaixo do valor. Nos dois casos a IA só paga até valor + 10% (às vezes 15%, `eg_0.HL`).
- **Empréstimo** (`components/t_0`): 366 dias; até 4 emprestados por time, até 10 emprestáveis; na volta, dono humano precisa de vaga. O emprestado pode ser comprado pelo valor sem consultar o dono (`eg_0.qF`).
- **Leilão** (`best/N`, `a/dz_0`): depois de rodada de liga, estadual ou regional, 0 a 3 sobras da IA (times com ≥ 21). Lance mínimo = metade do valor. O maior lance leva, mas abaixo de 2,5× o mínimo a IA cobre com 49% (paga mínimo × 1,45 ou 1,62 + o lance). O ramo `> 80 → 0,82` do original vem depois do `> 60` e nunca roda.
- **Junior promovido** (`k_0`): força = potencial + (base da divisão/reputação + 0..4, +5 na Europa) × progresso/100; +0..9 com potencial ≥ 9.
- **Janela da IA** (`ag.jO`, fim da temporada): cada time vende de 1 a 4 sobras (mais quanto pior a colocação), completa as posições em falta e os grandes da Europa levam estrelas (força > 50, < 31 anos) dos médios.


## Evolução e carreira (W5)

- **Evolução semanal** (todo domingo, `f_0.aT` → `F.fV`), acumulada em `eM`: a força sobe ou cai 1 a cada 1,0 acumulado.
  - **Até 31 anos** (`fW`): ganho de 1/50 a 8/50 por semana, pelo Nivel do clube (fora das ligas, pela reputação, +0,03) e pela idade. +0,04 se jogou na semana; −0,02 a −0,05 pela força; ex-junior ganha ou perde conforme progresso e potencial; craque +0,02, estrela +0,01; ajuste por continente/país.
  - **Teto** (`b`, `fW`): tabela [divisão][reputação] (Série A: 80–100) ou só reputação fora das ligas, limitado pelo país do clube (Brasil 90, Argentina 90, Inglaterra/Espanha/Itália/Alemanha/França 95…). O ex-junior com progresso ≥ 60 ganha +5 a +34 pelo potencial 7–10.
  - **32 anos ou mais** (`fX`): queda de `(idade − 31) × 0,7/1,0/1,2 ÷ 50` por semana (pela força; Nivel ≥ 20 conta 2 anos a menos), sem passar do piso da divisão (35/25/10).
  - **Habilidades** (opção habilidade individual): o mesmo ganho vai para a habilidade principal da posição (100%) e duas secundárias (40% e 30%); gol e desarme valem 1,2×. A cada 4 semanas, e sempre para o humano que escolhe "secundárias" sem o auxiliar, o ganho dobrado vai para uma habilidade sorteada (vel/tec/pas) por posição — é o treino (`a/iQ`).
  - **Juniores** (`fY`, até 20 anos): progresso 0–100 sobe ~0,5/semana aos 17 anos (+0,03 a +0,11 pelo potencial). Na criação, começa em 15/35/55/70/75 pela idade + potencial (`ga`); o olheiro mostra o potencial ±1 (`fZ`).
- **Virada do ano** (`f_0.af`): todos fazem aniversário.
  - **Aposentadoria** (`ge`), pela idade efetiva (estrela −1, craque −3, goleiro −3): 33–34 anos 10%, 35: 45%, 36: 70%, 37–38: 85%, 39: 95%, 40: 97%, 41–42: 98%, até 48: 99%, depois sempre. Na IA o jogador sai e entra um junior da mesma posição (promovido na hora se a posição fica curta ou o elenco < 16); às vezes vira técnico (1 em 25 na Série A, 1 em 5 se estrela, 1 em 2 se craque). No humano só há um aviso.
  - **Juniores de 20 anos** (`gf`): sobem se o potencial atinge o mínimo da reputação (1/4/5/6) e a posição tem menos de 3/5/5/8/6; senão, na IA, viram outro junior.
  - **Junior novo** (`F.a`): 16–19 anos; potencial por faixa de porte do clube; posição GOL 10%, LAT 20%, ZAG 20%, MEI 30%, ATA 20%; 1% sai estrela. O nome vem do arquivo do país (nome + sobrenome, `m_0.au`).
  - **Junior promovido** (`k_0`): o valor fica em 18% na temporada em que sobe (no máximo o preço pedido), 35% na seguinte e 65% na outra (`F.fK`).
- **Técnico** (`best/al`):
  - **Diretoria** (começa em 95) e **torcida** (85), 0–100, mudam a cada jogo oficial (`al.a`): empate ou derrota em casa contra mais fraco tira; o resultado vale pela faixa na tabela (líder, topo, meio, perto da degola, rebaixamento) com tabelas de liga, estadual/regional e continental; o confronto de mata-mata vale como um resultado inteiro no jogo decisivo. Goleada mexe mais com a torcida; torcida < 20 tira 3 da diretoria; caixa negativo tira 5–10. Título: +30 a +40 na torcida e +15 a +30 na diretoria.
  - O público do mandante cai com a torcida do técnico (`v_0.java:172`).
  - **Pontos de carreira** (`oc`): por vitória (1–8 por tipo de competição; +1 fora) e empate, e pela colocação final até o 10º.
  - **Reputação** 0–5 por pontos de reputação (`nu`): título/vice somam (liga 600/150, copa 500/150, Libertadores 6000/1000, Mundial 10000/1000; liga abaixo da A vale 50). Sobe com > 10, > 100, > 1 mil, > 10 mil, > 22 mil; no começo de cada temporada desconta 6000/600/50/5 (rep. 5/4/3/2), e cai um nível abaixo de −20 mil/−3 mil/−500/−50.
  - O time tem a sua reputação, igual: títulos 500/300/5000/40000, vice 90/50/1000/1000; sobe com > 100 mil para 5; cai com −90 mil/−9 mil/−1000 (de 2 não cai, bug mantido).
  - **Demissão** (`s.A`, depois de cada dia de liga ou estadual): diretoria < 10 derruba o humano (motivo: caixa negativo, torcida ou resultados) e o técnico da IA do 7º lugar para baixo. No fim da temporada a IA demite com chance `1 − vitórias%/90` (`ag.jQ`).
  - **Substituto** (`ah.kE`): técnico livre do país, de reputação igual, depois −1, depois −2/+1; no time de humano, qualquer um. Sem livres, o técnico da IA troca de time com o de um clube que lhe faria proposta. Sem substituto, o humano não sai (pedido recusado; demitido, fica um interino).
  - **Propostas** (`ay.b`, `Z.a`, `s.b`): dos times da liga BR, nas divisões da dele e vizinhas (tabelas por sorteio); empregado recebe na 20ª rodada da liga, de times do 3º ao 6º; desempregado, a cada dia de liga/estadual, dos 6 últimos.
- **Multi-humano já existe (hot-seat):** `ah.b(nome, nac)` cria um técnico humano, e todo o loop itera sobre a lista de humanos.

## UI (Swing, Nimbus)

### Telas

| Classe | Tela |
|---|---|
| `a.gq` | tela inicial: imagem `aiconsj/tela_inicial.jpg` com hotspots |
| `a.hU` | configurações do novo jogo |
| `a.bV` | técnicos humanos |
| `a.eg` | hub do time: tabela do elenco + barra com 11 ícones (Agenda, Seleção, Tabelas, Estádio, Juniores, Times, Treino, Procura, Técnicos, História, Opções) |
| `a.dV` | partida ao vivo: cabeçalho `panelh.png`; tabela com todos os jogos da rodada, nome do time com fundo `cor1` e texto `cor2` |
| `a.hk` | resultados da rodada |
| `a.cR` | fim de temporada |
| `a.cD` | escalação: campo 434×650, 25 slots, estilo, marcação, batedores |
| `a.cW` | finanças |
| `a.al` | classificação |
| `a.cq` | estádio |
| `a.dz` | leilão |

### Paleta

| Nome | Cor |
|---|---|
| shell | `#245B2D` |
| `or` | `#0C364D` |
| `os` | `#071C27` |
| linha da tabela de jogos | `#1B4626` |
| linha do time humano | `#1B3218` |
| célula de placar | `#547F3B` |

- Temas: azul `#004469`, verde-cinza `#687864` (padrão), preto, vinho `#6E0000`, roxo `#990099`.
- Fontes: Arial bold 12 e Tahoma bold 12/14.

### Assets

| Asset | Formato | Origem |
|---|---|---|
| Escudos | PNG 60×60 e mini 18×18 | `teams/escudos/<FileRef>.png` |
| Camisas | PNG 55×55 prontas | `camisas`, `camisas2`, `camisas3`; fallback por matiz da `cor1` para 6 camisas genéricas |
| Bandeiras | 20×20 e 36×36 | índice = país |
| Ícones de evento | 18×16 | — |
| Troféus | 72 PNG | — |
| Sons | 7 WAV de 8 kHz | gol1, goladv, intervalo, fimjogo, penalty, expulsao, contusao |

## Registro

- O código é validado por hash do nome (`best/D`, `h2.java:68`) e gravado em Java Preferences.
- A versão grátis tem estas limitações:
  - só permite começar na última divisão;
  - só um técnico humano;
  - desliga estaduais e torneios internacionais.
- O port ignora tudo isso: tudo fica liberado.

## Saves

- `sav/<nome>.s22` é Kryo com nomes de classe ofuscados. Importar esses saves no port não vale o esforço; o mundo é recriado a partir dos `.ban`.

## Oráculo estatístico (M6)

`tools/oracle.sh [N]` roda o motor original em processo (`tools/Oracle.java`): cria o mundo com `new c.a()` + `best.p.dd()/dg()` (o que o botão "Novo jogo" faz, sem a UI), monta partidas da Série A com o construtor de debug de `best.I`, preenche a competição (`f.B` tipo 1) e os minutos de substituição (`hb()`) por reflexão, escala com `ah.a(...)` e chama `V()`. Antes de cada jogo: energia 100, sem lesão/amarelos, e a força é restaurada depois (lesão de quem tem ≥35 anos tira 5 de força para sempre e contaminava as partidas seguintes). Saída: `packages/engine/src/ref-original.json`, a referência do teste estatístico do port.

Números do original (20 mil partidas, Série A, temporada 1): 2,65 gols/jogo, mandante 38% / empate 25% / visitante 37%, 27,5 chutes, 9,6% de conversão, 73% no alvo, 1,40 amarelo, 0,18 expulsão, 0,11 lesão e 6,5 substituições por jogo.

**O que o oráculo corrigiu no port:**
- Minutos de substituição não sorteados valem **−1** (`I.java:113-114`), não 0. Com 0, o intervalo (`m(2, 0)`) fazia trocas a mais.
- O elenco é **embaralhado** por `ah.kp()` na criação do mundo (`ah.java:1155`); isso desempata a escalação da IA entre jogadores de mesma força.
- (bug do port) amarelo tratado como lesão.

## Lacunas ainda não mapeadas

- Detalhes finos da W2: comparador `desempateEstadual`, chaveamento `Zy` da Série D, como `g_0` distribui ida e volta nas datas, conteúdo de `conf_estadual/*.ces`.
- Sorteio das continentais e dos grupos (cotas por país já mapeadas acima).
- Tabelas exatas de confiança da diretoria e da torcida.
