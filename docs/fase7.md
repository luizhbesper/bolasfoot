# Fase 7 — Base 2026 (tickets)

Detalhe dos tickets B1–B10 do `plano.md`. A base original (22-23) continua jogável ao lado da nova.

**Decisões da fase**
- **Duas bases.** `base-2022.json` (original) e `base-2026.json`. O admin escolhe ao criar o jogo; o jogo guarda qual usa, porque a virada de temporada lê a base. O oráculo, os `ref-*.json` e os testes golden ficam presos à 2022.
- **Fonte híbrida.** Elenco e valor de mercado vêm do Transfermarkt: o [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) (CC0) cobre a Série A e as ligas estrangeiras, e o [transfermarkt-api](https://github.com/felipeall/transfermarkt-api), rodando local, cobre as Séries B, C e D e os estaduais. A API-Football (grátis, 100 req/dia) serve só para conferir listas de clubes e IDs. O ToS do TM proíbe scraping, então é uso privado: o importador roda uma vez, com cache em `data-cache/` (gitignored), e os dados brutos nunca são commitados.
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
  base-2022.json, base-2026.json
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
Contrato: `base.json` → `base-2022.json`; `packages/data` exporta `bases: Record<'2022' | '2026', Base>` (a 2026 entra quando existir). Coluna `games.base` (default `'2022'`), escolhida no "criar jogo" do admin. Todo lugar do `apps/web` que carrega a base (catálogo da escolha, `comecarJogo`, rodada, virada) passa a usar a do jogo.
Fora de escopo: o conteúdo da 2026 (B3).
Testes: `base.test.ts` com as contagens da 2022 iguais às de hoje; integração: um jogo com `base = '2026'` (stub enquanto a B3 não existir) nasce e avança uma rodada.
Pronto quando: `pnpm check` verde; jogos existentes continuam na 2022.

## B2 — Mapa de clubes 2026
Objetivo: a lista revisada de todos os clubes da base 2026 e de onde vem cada um.
Fonte original: n/a.
Contrato: `clubes-2026.json`, uma linha por clube: `fileRef`, `tm` (id do TM), `apiFootball` (id), `pais`, `uf`, `divisao` (1–4 ou 0), `estadual` (divisão e grupo, quando houver). Estrangeiros: os participantes de Libertadores e Sul-Americana de 2026 mais o top ~15 por país pelo valor do elenco (o mesmo corte do `mundo.ts:423`). Script `conferir-clubes` compara as listas com a API-Football e com os fatos acima.
Fora de escopo: elencos.
Testes: o script acusa 0 divergências; cada clube do original que está na 2026 mantém o `fileRef`.

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

## B4 — Força real
Objetivo: o craque real nasce craque.
Fonte original: `mundo.ts:257-271` (`forcaInicial`, port de `F.java`).
Contrato: `Jogador.forca?` (opcional). O importador a deriva do valor de mercado: percentil por idade e posição, mapeado para a distribuição de força por divisão que a 2022 produz (medida no próprio `novoJogo`). Com `forca`, o `forcaInicial` só aplica o teto, sem os bônus de titular e estrela. Sem `forca`, nada muda.
Fora de escopo: habilidades (continuam semeadas a partir da `forca`, `mundo.ts:276`).
Testes: unitário no `forcaInicial` (com e sem o campo); na 2026, média e desvio da força dos 11 melhores por divisão perto da 2022.

## B5 — Divisões e estaduais explícitos
Objetivo: a 1ª temporada da base 2026 começa com os clubes reais em cada divisão.
Fonte original: `mundo.ts:489` (ranking por nivel), `brasil.ts:78-89` (estaduais).
Contrato: `Time.divisao?` e `Time.estadual?` (divisão e grupo) opcionais. Com eles, o mundo nasce com as divisões dadas; sem eles, segue o ranking por nivel (a 2022 não muda). Da 2ª temporada em diante, acesso e rebaixamento como estão.
Testes: o mundo da 2026 tem a Série A dos fatos acima; o da 2022 é idêntico ao de hoje (golden).

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
