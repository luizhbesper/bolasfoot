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
- **Divisão BR** não está nos dados: `Z.Ar()` (`best/Z.java:112-228`) ordena por Nivel com desempate aleatório (1..1000) e corta em blocos de `nTimes` (20/20/20/64). Sem estaduais, a Série D sai do Nivel 9, 8 e 1 sorteado do 7; o resto fica na divisão 0.
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
f = min(f,100)
```

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

A posse alterna o lado que "tenta" a cada tick. O parâmetro `k` vale 11 da 5ª rodada em diante e 8 antes; `kb` vale 10 e 8.

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
p = minuto<15?0 : <30?1 : 2 ; marc = {30,10,0}[marcação]
1ºT: amarelo 1/({70,40,30}[p]+marc)  vermelho 1/{1200,900,800}[p]  lesão 1/{1500,1000,800}[p]
2ºT: amarelo 1/({45,40,30}[p]+marc)  vermelho 1/{800,700,550}[p]   lesão 1/{800,600,600}[p]
>5 amarelos → denominador ×2; ≥2 vermelhos → Y=R*2; ≥1 lesão → Y=INJ*5
```

- O lado afetado é o mandante em 44% dos casos e o visitante em 56%.
- A vítima é sorteada por faixa de slots, com distribuições próprias para amarelo, vermelho e lesão.
- **Energia:** a cada 7 minutos todos perdem energia (o goleiro só no 2º tempo). A perda depende da idade: até 20 anos −1, até 25 −2, até 31 −3, até 36 −4, acima −5.
- **IA:** 5 substituições, com minutos sorteados antes do jogo. Entram cansados (energia < 60) e trocas táticas quando está perdendo.
- **Acréscimos:** 1º tempo `rand(3)`, 2º tempo `rand(5)+1`.
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

- **Gancho:** 3 amarelos. Vermelho direto suspende 1/2/3/5/10 jogos com probabilidades 70/20/7/2/1%.
- **Lesão:** dura `rand(14)` dias mais um adicional por idade. Há ainda 1% de chance de +70 dias, 3% de +40 e 6% de +20.
- **Recuperação de energia após a rodada:**

| Situação | até 20 | até 25 | até 31 | até 36 | acima |
|---|---|---|---|---|---|
| Jogou, time humano | +13 | +24 | +37 | +40 | +30 |
| Jogou, time da IA | +20 | +30 | +50 | +52 | +42 |
| Não jogou | +30 a +35 | | | | |

- **Notas:** dependem do resultado, da força e da estatística do setor. Gol +0.9, assistência +0.4, estrela +0.4, craque +0.6.

### Público e bilheteria (`best/v_0.java:90`)

- **Setores:** geral 15%, arquibancada 75%, cadeira 9% e camarote 0.9% da capacidade.
- **Fórmula por setor:**
  - parte da demanda base por reputação, de `{200,500,50,0}` (rep 0) a `{5000,40000,5500,500}` (rep 5);
  - ×0.7 em estadual/regional e ×0.4 em amistoso;
  - soma `capacidade×(0.3 + bônus da fase ou competição)`;
  - ±5% por nível de diferença de reputação com o visitante;
  - multiplica pela satisfação da torcida (`/100`);
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

### Calendário

- O ano tem um objeto por dia. Uma sequência fixa de chamadas `(diaDaSemana, tipo)` aloca os jogos: domingo é liga, quarta e quinta são copas.
- Eventos de dia:

| Evento | Quando |
|---|---|
| Salário | dia 2 do mês (mensal) ou todo domingo |
| Juros | dia 2 do mês |
| Evolução dos jogadores | todo domingo |
| Ofertas de emprego | — |

- Torneios de seleções seguem ciclos de 2 ou 4 anos.

### Avançar o dia (`f.ap`)

- Se algum time humano que joga hoje ainda não confirmou a escalação, o jogo abre a escalação dele. **Esse é o hot-seat.**
- Depois disso o dia é processado:
  1. escalações da IA;
  2. partidas;
  3. eventos;
  4. demissões e ofertas;
  5. transferências pendentes (com 50% de chance, a IA faz propostas pelos jogadores que os humanos listaram);
  6. obras do estádio.

### Fim de temporada

1. Prêmios e resets.
2. Novo calendário.
3. Sorteios internacionais.
4. Acesso e rebaixamento.
5. Envelhecimento e aposentadoria.
6. Juniores.
7. Rodízio de técnicos da IA.

## Economia

- **Só os times humanos têm dinheiro simulado.** A IA não tem caixa.
- **Caixa inicial por divisão:** 15M / 12M / 10M / 3.5M.
- **Patrocínio anual:** 6M / 4.5M / 2.5M / 2M.
- **Salários:** soma do elenco mais os juniores.
- **Prêmios:**
  - liga, top 6 da Série A: 5M, 3.5M, 2M, 1.5M, 1M, 0.5M;
  - copa nacional, por fase: 1M → 25M;
  - Libertadores: 2M → 40M;
  - Mundial: até 7M.
- **Empréstimo:** blocos de 500k, com limite por divisão (5M na div. 1). Juros de 3% ao mês.
- **Estádio:** obras levam de 15 a 40 dias, com custo por assento e teto por setor. Bug original: o teto real fica sempre em `pa[1]` a partir da 2ª temporada.
- **Demissão:** acontece quando a satisfação da diretoria fica abaixo de 10. A diretoria começa em 95 e a torcida em 85; ambas variam por resultado (`al.java:162-530`).
- **Valor do jogador:** `(2·força)² × mult`. O mult é 366 a 750 conforme o nível do time, ajustado por idade, craque, ídolo, atacante e titular.
- **Salário do jogador:** `força × 2 × round(base/2)`, menos um desconto por posição e idade.
- **Preço de venda da IA:**

| Situação do elenco vendedor | Preço |
|---|---|
| Tem jogadores sobrando na posição | valor +20–50%, ou −10–20% se o jogador for fraco ou velho |
| Ficaria com só um na posição | valor ×2.5 |
| Demais casos | valor ×2 |

- **Elenco:** no máximo 35 jogadores.
- **Contratos:** 180 dias, ou 365 dias em empréstimo. Há multa de rescisão.

## Evolução e carreira

- **Evolução semanal:**
  - abaixo de 32 anos: ganho de 1 a 8/50 por semana, conforme o nível do clube, a idade e o potencial; teto de força por divisão e país;
  - 32 anos ou mais: declínio de `(idade−31)×k/50` por semana.
- **Aposentadoria:** a chance sobe com a idade (32 anos: 1%, 35: 45%, 37: 85%, 40: 97%). Craques, ídolos e goleiros têm a idade efetiva reduzida.
- **Juniores:** de 16 a 19 anos, com potencial de 1 a 10. Posições: GOL 10%, LAT 20%, ZAG 20%, MEI 30%, ATA 20%. Há 1% de chance de sair um craque. O nome vem dos arquivos do país.
- **Técnico:** reputação de 0 a 5 por pontos de carreira (>10, >100, >1k, >10k, >22k).
  - Pontos por título: liga 500, copa 300, Libertadores 5000, Mundial 40000.
  - Pode receber ofertas de clubes e de seleções.
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

## Lacunas ainda não mapeadas

- Chaveamento da Copa do Brasil e da Série C (fórmula 1020): `best/Z.java`, `f/B.java`.
- Sorteio das continentais e dos grupos (cotas por país já mapeadas acima).
- Fórmulas dos estaduais: `f/o.java`, `best/w.java`.
- Sequência completa do calendário: `best/a.java:249`.
- Como a IA monta propostas pelos jogadores humanos.
- Tabelas exatas de confiança da diretoria e da torcida.
