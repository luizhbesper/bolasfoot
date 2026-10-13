// Menu do jogo (docs/fase4.md). `rota` é o sufixo depois de /jogo/[id]; null = tela de um ticket futuro.
import type { NomeIcone } from '../../_ui/icones.tsx'

export interface ItemNav { chave: NomeIcone; rotulo: string; rota: string | null }

export const CAIXA: ItemNav = { chave: 'caixa', rotulo: 'Caixa de entrada', rota: null }

export const GRUPOS: { titulo: string; itens: ItemNav[] }[] = [
  {
    titulo: 'Clube',
    itens: [
      { chave: 'hub', rotulo: 'Visão geral', rota: '' },
      { chave: 'elenco', rotulo: 'Elenco', rota: null },
      { chave: 'escalacao', rotulo: 'Escalação', rota: null },
      { chave: 'treino', rotulo: 'Treino', rota: null },
      { chave: 'juniores', rotulo: 'Juniores', rota: null },
    ],
  },
  {
    titulo: 'Competições',
    itens: [
      { chave: 'partida', rotulo: 'Partida', rota: null },
      { chave: 'tabelas', rotulo: 'Tabelas', rota: null },
      { chave: 'agenda', rotulo: 'Agenda', rota: null },
    ],
  },
  {
    titulo: 'Mercado',
    itens: [
      { chave: 'procura', rotulo: 'Procurar jogadores', rota: null },
      { chave: 'leiloes', rotulo: 'Leilões', rota: null },
      { chave: 'propostas', rotulo: 'Minhas propostas', rota: null },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { chave: 'financas', rotulo: 'Finanças', rota: null },
      { chave: 'estadio', rotulo: 'Estádio', rota: null },
    ],
  },
  {
    titulo: 'Mundo',
    itens: [
      { chave: 'times', rotulo: 'Times e técnicos', rota: null },
      { chave: 'historia', rotulo: 'História', rota: null },
      { chave: 'transferencias', rotulo: 'Transferências', rota: null },
    ],
  },
]

/** O item do menu da rota atual (para o título da barra). */
export function itemDaRota(sufixo: string): ItemNav | undefined {
  return [CAIXA, ...GRUPOS.flatMap((g) => g.itens)].find((i) => i.rota === sufixo)
}
