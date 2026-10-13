// Menu do jogo (docs/fase4.md). `rota` é o sufixo depois de /jogo/[id]; null = tela de um ticket futuro.
import type { NomeIcone } from '../../_ui/icones.tsx'

export interface ItemNav { chave: NomeIcone; rotulo: string; rota: string | null }

export const CAIXA: ItemNav = { chave: 'caixa', rotulo: 'Caixa de entrada', rota: null }

export const GRUPOS: { titulo: string; itens: ItemNav[] }[] = [
  {
    titulo: 'Clube',
    itens: [
      { chave: 'hub', rotulo: 'Visão geral', rota: '' },
      { chave: 'elenco', rotulo: 'Elenco', rota: 'elenco' },
      { chave: 'escalacao', rotulo: 'Escalação', rota: 'escalacao' },
      { chave: 'treino', rotulo: 'Treino', rota: 'treino' },
      { chave: 'juniores', rotulo: 'Juniores', rota: 'juniores' },
    ],
  },
  {
    titulo: 'Competições',
    itens: [
      { chave: 'partida', rotulo: 'Partida', rota: 'partida' },
      { chave: 'tabelas', rotulo: 'Tabelas', rota: 'tabelas' },
      { chave: 'agenda', rotulo: 'Agenda', rota: 'agenda' },
    ],
  },
  {
    titulo: 'Mercado',
    itens: [
      { chave: 'procura', rotulo: 'Procurar jogadores', rota: 'procura' },
      { chave: 'leiloes', rotulo: 'Leilões', rota: 'leiloes' },
      { chave: 'propostas', rotulo: 'Minhas propostas', rota: 'propostas' },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { chave: 'financas', rotulo: 'Finanças', rota: 'financas' },
      { chave: 'estadio', rotulo: 'Estádio', rota: 'estadio' },
    ],
  },
  {
    titulo: 'Mundo',
    itens: [
      { chave: 'times', rotulo: 'Times e técnicos', rota: 'times' },
      { chave: 'historia', rotulo: 'História', rota: 'historia' },
      { chave: 'transferencias', rotulo: 'Transferências', rota: 'transferencias' },
    ],
  },
]

/** O item do menu da rota atual (para o título da barra). */
export function itemDaRota(sufixo: string): ItemNav | undefined {
  return [CAIXA, ...GRUPOS.flatMap((g) => g.itens)].find((i) => i.rota === sufixo)
}
