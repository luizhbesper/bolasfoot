# Fase 4 — Front-end (tickets)

Detalhe dos tickets U0–U8 do `plano.md`. Gate: uma noite inteira no modo live, no prod, sem dessincronizar e sem abrir o console.

**Protótipo (U0):** https://claude.ai/artifact/9mvoxqeSM1nqiwmT28U8bZ — canvas com o sistema visual e as telas-chave (hub, escalação, partida, tabelas, mercado, caixa de entrada, escolha de times). É o gabarito visual da fase; `docs/ref/*.png` continua sendo só a lista do que cada tela mostra.

**Decisões da fase**
- **Tema escuro suave, fixo.** Sem modo claro, sem seletor.
- **Desktop-first, mobile usável:** a sidebar empilha/vira barra, tabelas rolam na horizontal, o campo escala por `aspect-ratio`.
- **Sem dependências novas.** CSS Modules + tokens em `app/globals.css`; ícones SVG inline em `app/_ui/icones.tsx`; gráficos em SVG à mão; fontes por `next/font/google`.
- **Fontes:** Geist (UI, sempre `tabular-nums`) e Bricolage Grotesque (placar e títulos).
- **Camisas do original na escalação** (campo e banco): `camisas/1/<fileRef>.png`, goleiro com a genérica escura, fallback pela matiz da `cor1` em `camisas/genericas`. É charme do Brasfoot; fica.
- **Cores do time** (`cor1`/`cor2` do original) só no escudo, na faixa do nome na partida e no header do clube. O resto da UI usa a paleta.
- **Chat fora** por ora: a call basta. O feed "Na liga dos amigos" (dos `round_logs` e transferências) cobre o social.

**Tokens**

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#13161c` | página |
| `--menu` | `#0f1217` | sidebar |
| `--surface` | `#1a1e26` | cards |
| `--raised` | `#222733` | hover, linhas, avatares |
| `--line` | `#2c3240` | bordas, trilhos das barras |
| `--text` / `--muted` / `--faint` | `#ebe7df` / `#a3a9b8` / `#6f7686` | texto |
| `--lavanda` | `#c3bcf5` | ação principal, seleção |
| `--menta` | `#a8dcc0` | vitória, pronto, positivo |
| `--pessego` | `#f3c49b` | prazo, alerta |
| `--rosa` | `#f0a8a8` | derrota, lesão, vermelho |
| `--ceu` | `#a6cdef` | informação, links |
| `--manteiga` | `#eedd9c` | amarelo, destaque |

Posição: GOL manteiga, LAT céu, ZAG lavanda, MEI menta, ATA rosa (texto na cor, fundo a 12%).

**Navegação** (sidebar agrupada): Caixa de entrada · **Clube** (visão geral, elenco, escalação, treino, juniores) · **Competições** (partida, tabelas, agenda) · **Mercado** (procurar, leilões, minhas propostas) · **Gestão** (finanças, estádio) · **Mundo** (times e técnicos, história, transferências). Topbar: título, caixa, data, próximo jogo, avatares dos técnicos com anel de pronto, prazo e o CTA da fase ("Estou pronto" / "Ir para a partida" / "Voltar ao intervalo"). A partida e a escolha de times são telas cheias, sem sidebar.

**Ordem:** U0 → U1 → U2 → U3 → U4 → U8 → U5 → U6 → U7. A U8 sobe porque o gate precisa da caixa de entrada.

---

## U0 — Protótipo de design
Objetivo: direção visual aprovada antes de codar.
Fonte original: n/a.
Contrato: o canvas acima + esta seção de tokens.
Pronto quando: o usuário aprova o canvas.

## U1 — Casca
Objetivo: tokens, layout do jogo e componentes base.
Contrato: `app/globals.css`; `app/jogo/[id]/layout.tsx` (sidebar + topbar); `app/_ui/` (Tabela densa ordenável, Painel/Drawer, Escudo, Camisa com fallback `camisas/genericas`, Bandeira, ChipPosicao, Forca, Energia, Forma, Avatar, icones). Hook de cliente `useMundo(gid)`: baixa `/api/games/[id]/snapshot`, guarda em contexto e rebaixa quando o SSE avisa mudança de rodada (absorve o `ao-vivo.tsx`).
Fora de escopo: telas.
Testes: nenhum novo (visual).
**Entregue:** `app/globals.css` (tokens + classes `.card`, `.tabela`, `.rolagem`, `.primario`), fontes no `app/layout.tsx`, `app/_ui/` (`ui.tsx`, `camisa.tsx`, `icones.tsx`), `app/jogo/[id]/` (`layout.tsx`, `contexto.tsx` com `useJogo`/`useRelogio`, `casca.tsx`, `nav.ts`, `consultas.ts`). O `ao-vivo.tsx` saiu: fase, prazo, prontos e o botão de pronto ficam na barra. Itens do menu sem tela ainda aparecem desabilitados. Tabela ordenável e drawer ficam para a U3, quando o elenco usar.

## U2 — Fora do jogo
Objetivo: entrar, convite, seus jogos, admin, lobby e escolha de times no visual novo.
Contrato: as telas existentes reestilizadas; escolha com busca ao vivo e picks pelo SSE (`lib/game/escolha.ts` sem mudar).
**Entregue:** `app/_ui/pagina.tsx` (moldura com marca e conta, `Erro`); classes `.form`, `.etiqueta`, `.secao`, `.linha` no `globals.css`. Seus jogos em cards (fase da rodada e time). Admin com tabela de jogos, técnicos e convites (com o link pronto para mandar). Lobby e escolha em `app/jogo/[id]/escolha.tsx`: busca e filtros no cliente sobre o catálogo do admin (40 por vez), times dos outros ocupados na hora, confirmar = pronto. Testado com dois navegadores: a escolha de um aparece no outro sem recarregar.

## U3 — Clube e escalação
Objetivo: hub, elenco e escalação jogáveis.
Fonte original: `docs/ref/04,05,10`.
Contrato: hub (próximo jogo, confiança, mini-tabela, feed), elenco (tabela + drawer do jogador), escalação (toque-no-jogador → toque-no-slot; formação, estilo, marcação, jogada, banco, batedores). Valida com `validar` no cliente e envia `escalar`/`tatica`/`batedores` por server action.
Testes: e2e mobile smoke (6.5 #3).
**Entregue:** hub (`hub.tsx`: próximo jogo com forma dos dois, avisos do elenco, confiança, caixa e folha, tabela/grupo da competição do próximo jogo, resultados dos amigos na última rodada), elenco (`elenco/`: tabela ordenável, filtro por posição, ficha numa gaveta `<dialog>` em `_ui/gaveta.tsx`) e escalação (`escalacao/`: campo com as camisas, banco, "fora do jogo", formação/estilo/marcação/jogadas, batedores; salva sozinha 600 ms depois de cada mudança). Servidor: `comandosPendentes` e `definirComandos` em `lib/game/rodada.ts` — escalação, tática, batedores, treino e ingresso substituem o anterior da fase; o resto se soma. E2E `e2e/clube.e2e.ts` no celular.
**Lacuna do motor achada aqui:** contratos vencem e ninguém sai do time (no jogo local, quase todo o elenco do humano está com "contrato vencido" desde agosto). O original trata no pós-jogo (`hg`, ver RE "as()"); o port não. Entra como ticket próprio do motor antes do gate da fase.

## U4 — Partida
Objetivo: partida ao vivo sincronizada, intervalo e resultados.
Fonte original: `docs/ref/06,07,08`.
Contrato: placar grande do seu jogo + jogos dos amigos + todos os jogos por competição; eventos no relógio do servidor; sons; intervalo como painel (`substituir`/`mudarTatica` com prazo); resultados da rodada.
Testes: e2e live (6.5 #1).
**Entregue:** `app/jogo/[id]/partida/` em tela cheia (a casca sai nessa rota). O log da rodada (`round_logs`) agora guarda **todas** as partidas do dia (motor: `Rodada.todas`), com competição, números do time (posse, finalizações, no gol, desarmes, erros de passe) e o nome de quem dá a assistência/entra; o cliente recebe o log inteiro e mostra só o que o relógio do servidor alcançou (espiar não muda nada: tudo já está decidido). Seu jogo em destaque (faixa `cor1`/`cor2`, escudos, placar, lances; números só quando o tempo acaba), cards dos jogos dos amigos e "Todos os jogos" por competição. Sons do original (`assets/sons`) para os lances do seu jogo, intervalo e fim, com botão de mudo (`localStorage`). Intervalo: painel com quem está em campo e no banco (toque em quem sai, depois em quem entra), desfazer, estilo/marcação/jogada; cada mudança manda a lista inteira (`enviarComandosAcao`). O apito inicial leva quem está em campo para a partida; a barra troca o CTA por "Ir para a partida" / "Voltar ao intervalo" / "Ver resultados". Nos resultados, o snapshot já é o da rodada seguinte (tabelas atualizadas). E2E `e2e/live.e2e.ts` (convite, escolha, prontos, intervalo, mesmo resultado nos dois navegadores; apaga o jogo no fim).
**Achado:** com dois servidores no mesmo banco (o `pnpm dev` aberto + o do e2e), o agendador de um transicionava e o SSE do outro nunca sabia. O canal passou a repassar por `LISTEN/NOTIFY` (`iniciarCanal` na subida; os testes não ligam).

## U8 — Caixa de entrada e fim de temporada
Objetivo: substituir os modais do original.
Contrato: lista com filtros e detalhe; propostas humanas (`responderProposta`), ofertas de emprego (`aceitarOferta`), aposentadoria, demissão, fim de temporada. **Motor:** `Aviso` ganha `tipo` e ref opcional (golden atualizado de propósito).
**Entregue:** motor: `Aviso.tipo` (`proposta`, `mercado`, `emprego`, `demissao`, `aposentadoria`, `temporada`) e `ref` (proposta ou jogador), valores em "R$ 1,9 mi", e na virada um aviso de resumo por técnico humano (colocação na série, acesso/queda, títulos, campeões). O golden da temporada não mudou: ele vira a temporada pelo `fimDeTemporada`, sem a rodada. Tela `caixa` (filtros por tipo, não lidos marcados, detalhe com a ação: aceitar/recusar proposta de amigo, aceitar oferta de emprego, deixar se aposentar; carreira com pedir demissão) e contador de não lidos no menu (último dia visto no `localStorage`, por aparelho). Hub avisa a virada da temporada; sem clube aponta para a caixa. A barra de prontos e prazo já vinha da U1. Avisos de mundos antigos (sem `tipo`) aparecem como mercado. E2E `e2e/caixa.e2e.ts` (dois técnicos: proposta chega na caixa com contador e é aceita).

## U5 — Competições e mundo
Contrato: tabelas (de `FaseLiga.linhas`), agenda, história, times e técnicos, transferências. **Motor:** estatísticas de temporada por jogador (gols, assistências, jogos, notas) acumuladas no pós-jogo, para artilharia e a ficha do jogador.
**Entregue (falta conferir no navegador):** motor com `JogadorM.estatisticas` por competição (`[jogos, gols, assistências, amarelos, vermelhos, soma das notas]`, somadas no `aplicarPosJogo`, zeradas na virada) e `Historico.artilheiro` (golden atualizado de propósito). Telas `tabelas` (chips das suas competições + séries, fases, liga/grupos com zonas, chaves do mata-mata, artilharia, próximos jogos), `agenda`, `historia` (campeões, vice, artilheiro; hall da fama), `times` (elenco de qualquer time com a ficha; ranking de técnicos; trocas de técnico), `transferencias` (busca, só amigos). A ficha do jogador ganhou a temporada por competição.

## U6 — Gestão
Contrato: finanças (`financas`), estádio, ingresso, obras (`orcamentoObra`), empréstimo.
**Entregue:** base comum `comandos.tsx` (`useComandos`: manda o pedido pelo servidor, mostra os pendentes da rodada com desfazer, erro do motor; só no planejamento) e `pendentes.ts`. `financas` (caixa, folha, empréstimo com limite e juros, extrato da temporada; pegar/devolver 500 mil) e `estadio` (setores com teto, obra com orçamento ao vivo, ingressos automáticos ou por setor com o padrão da liga). Motor: `limiteEmprestimo` e `PARCELA_EMPRESTIMO` exportados.

## U7 — Mercado
Contrato: procura com chips de filtro, proposta com prévia de aceite (`precoVendaIA`, `aceitaIr`) e aviso de disputa com amigo, leilões e lance, juniores, treino, emprestados, renovação. Lista à venda = `jogadores.filter(j => j.aVenda)`.
**Entregue:** `procura` (chips de posição, força, idade, preço, à venda, empréstimo; ficha com proposta e prévia do que a IA faria — `aceitaIr`/`precoVendaIA`; jogador de amigo vai para a caixa dele), `leiloes` (lance por lote), `propostas` (recebidas de amigos com aceitar/recusar, enviadas esperando, pedidos da rodada e o resultado da última com "aceitar contraproposta"), `juniores` (promover/dispensar), `treino` e, na ficha do seu jogador no elenco, "Negociar" (lista, vender agora, empréstimo, devolver/comprar emprestado, renovação, aposentadoria). Disputa com amigo: o motor resolve compras da IA pela maior oferta; a tela avisa (as propostas dos outros são secretas). E2E `e2e/mercado.e2e.ts`.
