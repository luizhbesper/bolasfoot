// Mundos de teste (usado só pelos testes e pelo sim).
import { criarCalendario } from './calendario.ts'
import type { JogadorM, Mundo, TimeM } from './mundo.ts'

// posições do elenco sintético: 2 GOL, 4 LAT, 5 ZAG, 6 MEI, 5 ATA
const POSICOES = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4] as const

/** Dois times idênticos (força fixa, sem características especiais). */
export function mundoSintetico(forca = 50, reputacao = 5): Mundo {
  const mundo: Mundo = { seed: 'sintetico', temporada: 1, dia: 0, diaEventos: -1, calendario: criarCalendario(2026), competicoes: [], colocacoesEstaduais: [], opcoes: { habilidadeIndividual: false }, times: [], jogadores: [] }
  for (const id of [0, 1]) {
    const ids = POSICOES.map((posicao, k) => {
      const j: JogadorM = {
        nome: `J${id}-${k}`, pais: 29, idade: 26, posicao, lado: k % 2, cr1: 12, cr2: 12, estrela: false, craque: false, potencial: 5,
        titular: true, id: mundo.jogadores.length, time: id, juvenil: false, ex: posicao === 4 ? 1 : posicao === 3 ? k % 2 : k % 2,
        forca, energia: 100, habilidades: null, suspensoes: {}, lesaoAte: 0, jogou: false, valor: 0, salario: 0, contratoAte: 0,
      }
      mundo.jogadores.push(j)
      return j.id
    })
    const t: TimeM = {
      fileRef: `t${id}`, nome: `Time ${id}`, capacidade: 40000, cor1: '#000', cor2: '#fff', corBase: 0, pais: 29, uf: 25,
      nivel: 18, reputacao, tecnico: '', tecNac: 29, id, divisao: 1, ligaNacional: true, continente: 1, desempate: 1, humano: false, financas: null,
      jogadores: ids, juniores: [], tatica: { formacao: 4, estilo: 0, marcacao: 0, jogada: 0 }, batedores: { falta: null, escanteio: null },
      estadio: { nome: 'Estádio', setores: [6000, 30040, 3600, 360], precoAuto: true, precos: null },
    }
    mundo.times.push(t)
  }
  return mundo
}
