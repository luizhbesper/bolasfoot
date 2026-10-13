# Referência visual (F0-6)

Telas do Brasfoot 22-23 original, gabarito da UI (Fase 4). Geradas por `tools/capture-ref.sh`, que roda o jogo
dentro de `tools/RefShots.java` e segue o roteiro `tools/capture-ref.txt` (sem intervenção, sem permissão de tela).
Resolução da janela principal = tela do Mac (1470×923); os dialogs saem no tamanho próprio.

| Arquivo | Tela | Classe Swing |
|---|---|---|
| `01-tela-inicial.png` | Tela inicial (hotspots sobre imagem) | `a.gq` |
| `02-novo-jogo.png` | Configurações iniciais do novo jogo | `a.hU` |
| `03-tecnico-humano.png` | Adicionar técnico humano / escolher time | `a.bV` |
| `04-hub-pre-temporada.png` | Hub do time antes da 1ª rodada | `a.eg` |
| `05-escalacao.png` | Escalação (4-4-2 automático) | `a.cD` |
| `06-partida.png` | Partida ao vivo, todos os jogos da rodada | `a.dV` |
| `07-intervalo.png` | Intervalo: substituições e tática |  |
| `08-pos-jogo.png` | Resumo pós-jogo (notas, gols, cartões, estatísticas) | `a.hk` |
| `10-hub.png` | Hub do time depois da 1ª rodada | `a.eg` |
| `11-tabelas.png` | Tabelas / classificação | `a.al` |
| `12-estadio.png` | Estádio: ingressos e obras | `a.cq` |
| `13-juniores.png` | Academia de juniores |  |
| `14-procura.png` | Procura de jogadores (filtros) |  |
| `15-times.png` | Times: árvore de clubes + elenco |  |
| `17-agenda.png` | Agenda: jogos do seu time |  |
| `18-agenda-amistosos.png` | Agenda: marcar amistoso |  |
| `19-central-empregos.png` | Central de empregos |  |
| `20-ranking-tecnicos.png` | Ranking de técnicos |  |
| `21-tecnicos-humanos.png` | Adicionar/remover técnicos humanos |  |
| `22-trocas-tecnicos.png` | Últimas trocas de técnicos |  |
| `23-historia-campeoes.png` | História: campeões |  |
| `24-ranking-clubes.png` | História: ranking de clubes |  |
| `25-artilheiros.png` | História: artilheiros |  |
| `26-time-da-rodada.png` | História: time da rodada |  |
| `27-transferencias.png` | Últimas transferências |  |
| `28-preferencias.png` | Opções / preferências |  |
| `29-financas.png` | Finanças (clique no saldo do hub) | `a.cW` |
| `30-confronto.png` | Histórico do confronto (ícone do próximo jogo) |  |
| `31-jogador-estatisticas.png` | Estatísticas do jogador |  |
| `32-jogador-contrato.png` | Renovar contrato |  |
| `33-galeria-trofeus.png` | Galeria de troféus do time |  |
| `34-retrospecto.png` | Retrospecto do time |  |
| `35-emprestados.png` | Jogadores emprestados |  |
| `36-cores.png` | Cores do time |  |

## Limitações

- **Versão grátis:** só começa na Série D (ASA), sem estaduais/internacionais; proposta por jogador bloqueada.
- **Faltam:** proposta/negociação, leilão (aparece aleatoriamente depois da rodada), fim de temporada, demissão/oferta de emprego, pênalti com humano. Capturar quando a Fase 4 precisar (exige jogar uma temporada ou eventos aleatórios).
- **Rodada não é determinística:** um evento aleatório com modal (ex.: pênalti) pode travar o roteiro. Rodar de novo.
- Rodar de novo sobrescreve os PNGs de mesmo nome.
- Bônus: ao criar o jogo, o original imprime no stdout o calendário inteiro da temporada (data, dia da semana e nº do dia de cada rodada por competição). Útil para a W1.
