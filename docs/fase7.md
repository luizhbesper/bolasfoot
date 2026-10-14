# Fase 7 — Base 2026 (tickets)

Detalhe dos tickets B1–B10 do `plano.md`. A base original (22-23) continua jogável ao lado da nova.

**Decisões da fase**
- **Duas bases.** `base.json` (original, 2022) e `base-2026.json`. O admin escolhe ao criar o jogo; o jogo guarda qual usa, porque a virada de temporada lê a base. O oráculo, os `ref-*.json` e os testes golden ficam presos à 2022.
- **Fonte híbrida.** Elenco e valor de mercado vêm do Transfermarkt: o [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) (CC0) cobre a Série A e as ligas estrangeiras, e o [transfermarkt-api](https://github.com/felipeall/transfermarkt-api), rodando local, cobre as Séries B, C e D, os estaduais e as listas de participantes de 2026 (o TM chama a temporada brasileira de 2026 de `season_id=2025`). A API-Football grátis ficou de fora: só libera as temporadas de 2022 a 2024. O ToS do TM proíbe scraping, então é uso privado: o importador roda uma vez, com cache em `data-cache/` (gitignored), e os dados brutos nunca são commitados.
- **Força real.** O jogador ganha `forca?`, derivada do valor de mercado. Sem ela, o `forcaInicial` do original faz dois titulares do mesmo time nascerem quase iguais.
- **F7 cuida do nacional, F6 do continental.** Esta fase põe os formatos nacionais de 2026 e entrega os participantes continentais da 1ª temporada como dado (B9). A F6 porta as continentais do original, cujo formato da Libertadores (3 preliminares e 8 grupos de 4) já é o de 2026.
- **O formato de 2026 vale para sempre** na base 2026. A Série C com 24 clubes em 2027 e 28 em 2028 fica de fora até fazer falta.
- **`fileRef` estável.** Clube que existe no original mantém o `fileRef` (é a chave do escudo, da escolha de time e do `GRUPOS_SP`). Clube novo ganha um slug novo.

**Duas levas** (para não conflitar com a F6, que mexe em `brasil.ts`, `competicoes.ts`, `calendario.ts` e `temporada.ts`):
1. Já: B1, B2 → B3 → B4, B8, B9. Tocam `packages/data`, `tools/`, a criação do jogo no `apps/web` e só o `forcaInicial` no motor.
2. Depois que a F6 entrar na `dev`: B5 → B6 → B7, e o gate B10.

## Fatos de 2026

Conferir de novo no ticket.
- **Calendário CBF:** estaduais de 11/01 a ~15/03, em até 11 datas; Brasileirão de 28/01 a 02/12, com pausa para a Copa do Mundo de 11/06 a 19/07. ([netvasco](https://www.netvasco.com.br/n/370252/cbf-anuncia-calendario-de-2026-com-estaduais-em-11-datas-e-brasileiro-iniciando-em-janeiro-e-terminando-em-dezembro))
- **Série A:** Atlético-MG, Athletico-PR, Bahia, Botafogo, Bragantino, Chapecoense, Corinthians, Coritiba, Cruzeiro, Flamengo, Fluminense, Grêmio, Internacional, Mirassol, Palmeiras, Remo, Santos, São Paulo, Vasco e Vitória. Pontos corridos, caem 4.
- **Série B:** América-MG, Athletic, Atlético-GO, Avaí, Botafogo-SP, Ceará, CRB, Criciúma, Cuiabá, Fortaleza, Goiás, Juventude, Londrina, Náutico, Novorizontino, Operário-PR, Ponte Preta, São Bernardo, Sport e Vila Nova. Sobem o 1º e o 2º; as outras duas vagas saem do playoff (3º×6º e 4º×5º, ida e volta). ([wikipedia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2026_-_S%C3%A9rie_B))
- **Série C:** Amazonas, Anápolis, Barra-SC, Botafogo-PB, Brusque, Caxias, Confiança, Ferroviária, Figueirense, Floresta, Guarani, Inter de Limeira, Itabaiana, Ituano, Maranhão, Maringá, Paysandu, Santa Cruz, Volta Redonda e Ypiranga-RS. Turno único; os 8 primeiros vão para 2 quadrangulares (sobem 2 de cada), depois final. Caem 2. ([wikipedia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2026_-_S%C3%A9rie_C))
- **Série D:** 96 clubes ([lista](https://www.tnh1.com.br/noticia/nid/serie-d-2026-definidos-os-96-clubes-classificados-confira-lista/)). 1ª fase em 16 grupos de 6, ida e volta; avançam 4 de cada (64), e daí é mata-mata. Sobem os 4 semifinalistas e mais 2 de um playoff entre os eliminados nas quartas (6 no total). Vagas: os 4 rebaixados da C, 2 por UF e o resto pelo ranking.
- **Copa do Brasil:** 126 clubes em 9 fases. Fases 1–4 em jogo único, 5–8 em ida e volta, final em jogo único. A Série A entra na 5ª fase. ([Lance](https://www.lance.com.br/futebol-nacional/copa-do-brasil-2026-confira-classificados-formato-e-quando-estreiam-os-times.html))
- **Continentais:** Libertadores com Flamengo, Palmeiras, Cruzeiro, Mirassol, Fluminense e Corinthians nos grupos, e Botafogo e Bahia na preliminar. Sul-Americana com Atlético-MG, Bragantino, Grêmio, Santos, São Paulo e Vasco. Recopa: Lanús × Flamengo. Supercopa: Flamengo × Corinthians. ([trivela](https://trivela.com.br/brasil/campeonato-brasileiro/libertadores-sul-americana-brasileiros-2026/))

**Convenções:** as da Fase 2. Arquivos:

```
packages/data/
  base.json (2022), base-2026.json
  src/clubes-2026.json     B2 (mapa revisado à mão)
  src/importar-2026.ts     B3, B4, B8, B9
  src/diff.ts              B3 (entrou/saiu/mudou)
packages/engine/src/
  mundo.ts                 B4 (forcaInicial), B5 (divisao explícita)
  brasil.ts, competicoes.ts, temporada.ts   B5, B6
  calendario.ts            B7
apps/web/lib/              B1 (base do jogo)
data-cache/                gitignored: dumps e respostas cacheadas
```

---

## B1 — Base versionada
Objetivo: o jogo escolhe entre a base 2022 e a 2026 e a usa até o fim.
Fonte original: n/a.
Contrato: a 2022 continua em `packages/data/base.json` (os testes do motor a importam direto); a 2026 vira `base-2026.json`. `apps/web/lib/game/base.ts` tem `bases` (chave → `Base`) e `baseDe(config)`. A escolha fica em `games.config.base` (jsonb, sem migração; ausente = `'2022'`), num select do "criar jogo" do admin que lista as chaves de `bases`. O catálogo da escolha, o `comecarJogo`, a resolução da rodada e os nomes de time nas telas usam a base do jogo; a lista de países continua da 2022 (é a mesma nas duas).
Fora de escopo: o conteúdo da 2026 (B3 registra a chave `'2026'` em `bases`).
Testes: os existentes (a 2022 não muda). O teste de um jogo com a 2026 entra na B3, junto com o arquivo.
Pronto quando: `pnpm check` verde; jogos existentes continuam na 2022. **Feito.**

## B2 — Mapa de clubes 2026
Objetivo: a lista revisada de todos os clubes da base 2026 e de onde vem cada um.
Fonte original: n/a.
Contrato: `pnpm --filter @bolasfoot/data clubes:2026` (`src/clubes-2026.ts`, com `src/tm.ts` para o acesso ao TM e o cache) gera `clubes-2026.json`: `{ clubes, mantidos }`. Cada clube tem `tm`, `nome`, `fileRef`, `novo`, `pais`, `uf`, `divisao` (1–4 ou 0), `estadual` (id do TM), `copa`, `continentais` e `valor`.
- **Brasil:** Séries A–D, Copa do Brasil e a 1ª divisão dos 27 estaduais de 2026 (o TM não tem o Amazonense).
- **Estrangeiros:** 37 ligas (as da CONMEBOL, México, MLS, Europa, Arábia, Japão, Coreia e Austrália), com até a cota de times que o original tem no país, escolhidos pelo valor, mais todos os de Libertadores, Sul-Americana e Recopa. País fora dessas ligas fica com os times do original (`mantidos`).
- **Casamento com o original:** por nome dentro do mesmo país e UF, ignorando prefixos (EC, SE…), "de/do/da" e a UF no fim do nome. O que o nome não resolve vai em `MANUAL`, `MANUAL_NOME` (nomes que o original traduziu) e `UF_MANUAL`.
Fora de escopo: elencos.
Testes: o script lista o que não casou (ambíguo, sem país, sem UF, `fileRef` repetido), os clubes novos e os originais que ficaram de fora; tem que sair sem nenhum problema. **Feito:** 501 clubes, 275 deles brasileiros (143 novos), séries 20/20/20/96, Copa com 126; dos 226 estrangeiros, 145 casados com o original; 235 estrangeiros mantidos.

## B3 — Importador
Objetivo: `pnpm data:build:2026` gera o `base-2026.json` a partir do `data-cache/`.
Fonte original: contrato em `packages/data/src/types.ts`; o que o motor usa de cada campo está no mapeamento da F7 (ver "Notas" no `plano.md`).
Contrato: o elenco é o de **2026-01-15**, remontado pelas transferências datadas. Mapeamentos:
- posição do TM → `posicao` + `lado`; sub-posição → `cr1/cr2` por uma tabela fixa;
- nacionalidade → índice de `paises`, **sem mexer na ordem dos países** (BRA=29 e outros índices estão fixos no motor);
- `idade` em 01/01/2026;
- `titular`: os 11 com mais minutos em 2025 que formam um time (1 GOL, 4 DEF, …); sem minutos, pelo valor;
- `estrela`/`craque`: topo de valor (corte calibrado para dar a mesma proporção da 2022);
- `potencial`: idade e valor;
- `Time.nivel`/`reputacao`: percentil do valor do elenco dentro do país, na mesma faixa da 2022;
- estádio, capacidade e técnico vêm do TM; cores do original ou à mão;
- clube sem dados no TM: elenco sintético pelo `base.nomes`;
- `juniores` vazios (o motor gera);
- `paises`, `ufs`, `nomes`, `ligas`, `estaduais` e `opcoes` copiados da 2022 (a B6 muda o que precisar).
Também gera `diff.ts`: por time, quem entrou, quem saiu e o que mudou, contra a 2022, para revisar antes do commit.
Fora de escopo: `forca` (B4), escudos (B8).
Testes: `base.test.ts` da 2026 com invariantes (todo time tem ≥ 18 jogadores e ≥ 2 goleiros; 20/20/20 nas séries A–C; nenhum `pais` fora do índice; `nivel` 1–20).
**Feito** (`pnpm --filter @bolasfoot/data importar:2026`):
- 736 times (275 BR), 16,5 mil jogadores.
- Valor em 15/01 vem do dataset (CSV com aspas!) e, sem ele, do elenco atual.
- Clube sem dados no TM: o importador cacheia a falha (404/502) e completa o elenco primeiro com os jogadores do original, depois com gerados. As Séries A e B ficaram sem nenhum gerado.
- Os estrangeiros mantidos vêm iguais aos da 2022.
- O diff para revisar sai em `data-cache/diff-2026.md`.

## B4 — Força real
Objetivo: o craque real nasce craque.
Fonte original: `mundo.ts:257-271` (`forcaInicial`, port de `F.java`).
Contrato: `Jogador.forca?` (opcional). O importador a deriva do valor de mercado: percentil por idade e posição, mapeado para a distribuição de força por divisão que a 2022 produz (medida no próprio `novoJogo`). Com `forca`, o `forcaInicial` só aplica o teto, sem os bônus de titular e estrela. Sem `forca`, nada muda.
Fora de escopo: habilidades (continuam semeadas a partir da `forca`, `mundo.ts:276`).
Testes: unitário no `forcaInicial` (com e sem o campo); na 2026, média e desvio da força dos 11 melhores por divisão perto da 2022.
**Feito:**
- A força sai do ranking global do valor ajustado pela idade, casado com a força dos profissionais no `novoJogo` da 2022.
- O motor usa a força dada, mas roda a fórmula assim mesmo, para o sorteio não mudar.
- No admin, a opção "Força dos jogadores pelo valor de mercado" (`config.forcaDaBase`, `OpcoesJogo.forcaDaBase`) vem marcada; desmarcada, vale a fórmula do original.
- Força dos 11 melhores: Flamengo 41, Palmeiras 40, Remo 30, Manchester City 53. A Série A da 2022 nascia com ~48: o B10 decide se escala.

## B5 — Divisões e estaduais explícitos
Objetivo: a 1ª temporada da base 2026 começa com os clubes reais em cada divisão.
Fonte original: `mundo.ts:489` (ranking por nivel), `brasil.ts:78-89` (estaduais).
Contrato: `Time.divisao?` e `Time.estadual?` (divisão e grupo) opcionais. Com eles, o mundo nasce com as divisões dadas; sem eles, segue o ranking por nivel (a 2022 não muda). Da 2ª temporada em diante, acesso e rebaixamento como estão.
Testes: o mundo da 2026 tem a Série A dos fatos acima; o da 2022 é idêntico ao de hoje (golden).
**Feito:**
- Os campos são `Time.divisaoInicial` (1–3) e `Time.estadualInicial`.
- A Série D continua saindo dos estaduais, com 64 vagas, até a B6.
- `pnpm sim --temporadas N --base 2026` roda temporadas com a base nova.

## B6 — Formatos nacionais 2026
Objetivo: Séries, Copa e estaduais jogados como em 2026.
Fonte original: n/a para o que é novo; o código de base é o de `brasil.ts`/`competicoes.ts`.
Contrato: `opcoes.formato` (`2022 | 2026`) escolhe o formato, sem `if` espalhado. Entram:
- **Série B:** playoff de acesso (3º×6º, 4º×5º, ida e volta);
- **Série C:** 2 rebaixados;
- **Série D:** 96 clubes, 16 grupos de 6, 64 no mata-mata, playoff das quartas, 6 sobem; vagas pelos rebaixados da C, 2 por UF e o resto pelo nivel. O 64 de `brasil.ts:231` sai da config;
- **Copa do Brasil:** 126 clubes, 9 fases, entrada escalonada (Série A na 5ª), final em jogo único;
- **estaduais:** até 11 datas; o formato real nos ~10 maiores (SP, RJ, MG, RS, PR, BA, PE, CE, GO, SC) e a fórmula genérica no resto.
Fora de escopo: continentais (F6).
Testes: por formato, nº de jogos, quem sobe e quem cai; uma temporada da 2026 sem erro.

## B7 — Calendário 2026
Objetivo: as datas reais da CBF na base 2026.
Fonte original: `calendario.ts:54` (`SEQUENCIA` do original, que a 2022 mantém).
Contrato: uma sequência própria da 2026, escolhida pelo `opcoes.formato`: estaduais em jan–mar, Brasileirão de jan a dez com a pausa da Copa, Copa do Brasil nas datas reais. As datas dos tipos continentais ficam onde a F6 as deixar.
Testes: nenhuma competição lança "faltam datas"; as datas da 1ª rodada da Série A e da final da Copa batem com a CBF.

## B8 — Escudos dos clubes novos
Objetivo: todo clube da 2026 aparece com escudo.
Fonte original: n/a.
Contrato: o importador baixa o escudo (URL do TM) para `data-cache/escudos/`; o `tools/assets.mjs` copia o original e depois o `data-cache/escudos/`. Escudo ganha fallback genérico em `apps/web/app/_ui/ui.tsx:7` (a camisa já tem).
Testes: o teste de escudo do `base.test.ts` vale para as duas bases.

## B9 — Participantes continentais para a F6
Objetivo: a 1ª temporada da 2026 tem os classificados reais das continentais.
Fonte original: n/a. Na F6, o original escolhe por cota de país (`f/b`, `Z.a`).
Contrato: `Base.continentais?: Record<string, { fileRef: string; entrada: string }[]>` (Libertadores, Sul-Americana, Recopa e Supercopa de 2026; `entrada` = `grupos` / `preliminar1`…). Quando existe, a F6 o usa na 1ª temporada no lugar da cota; da 2ª em diante, segue a cota.
Fora de escopo: as competições (F6).
Testes: todo `fileRef` de `continentais` existe em `times`.

## B10 — Gate
Objetivo: a base 2026 joga temporadas inteiras com números plausíveis.
Contrato: `pnpm sim --base 2026 --temporadas 10 --mundos 5`.
Testes: um `temporada.stats.test.ts` leve para a 2026 (tolerância folgada contra a 2022: gols por jogo, mandante, força dos 11 melhores por divisão; times grandes no topo na média).
Pronto quando: sim sem erro; um jogo novo no staging, com a base 2026, joga uma temporada inteira.
