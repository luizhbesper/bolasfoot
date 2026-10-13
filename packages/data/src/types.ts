// Formato do base.json: dados do Brasfoot 22-23 limpos e tipados. Gerado por build.ts.

/** 0 GOL, 1 LAT, 2 ZAG, 3 MEI, 4 ATA */
export type Posicao = 0 | 1 | 2 | 3 | 4

/** Características (Cr1/Cr2): 0 Col, 1 DPe, 2 Ref, 3 SGo, 4 Arm, 5 Cab, 6 Cru, 7 Des, 8 Dri, 9 Fin, 10 Mar, 11 Pas, 12 Res, 13 Vel */
export type Caracteristica = number

export interface Jogador {
  nome: string
  pais: number
  idade: number
  posicao: Posicao
  /** ignorado pelo motor de partida */
  lado: number
  cr1: Caracteristica
  cr2: Caracteristica
  estrela: boolean
  /** TopMundial do original (F.java:2064) */
  craque: boolean
  /** Hash do original, 0–10 (F.java:531) */
  potencial: number
  /** Status == 1 */
  titular: boolean
}

export interface Time {
  /** chave única (nome do .ban, escudo e camisa). O Id do original não é único. */
  fileRef: string
  nome: string
  estadio: string
  capacidade: number
  cor1: string
  cor2: string
  corBase: number
  pais: number
  /** índice em Base.ufs; só times BR (estrangeiros: null) */
  uf: number | null
  /** 6–20 */
  nivel: number
  /** 0–5 */
  reputacao: number
  tecnico: string
  tecNac: number
  jogadores: Jogador[]
  juniores: Jogador[]
}

export interface Pais {
  /** índice usado em Time.pais/Jogador.pais (best/ac.java) */
  id: number
  codigo: string
  nome: string
  /** 0 Europa, 1 América do Sul, 2 África, 3 Ásia, 4 CONCACAF, 5 Oceania, -1 nenhum */
  continente: number
  /** ac.fn(), usado na força do jogador (F.java:660) */
  nivel: number
}

export interface Uf {
  sigla: string
  nome: string
  gentilico: string
}

/** est.ConfigLigaType (só Brasil) */
export interface ConfigLiga {
  divisao: number
  nome: string
  nomeDivisao: string
  nTimes: number
  nGrupos: number
  nRebaixados: number
  rebaixadosDireto: number
  doisTurnos: boolean
  formula: number
  desempate: number
  numeroTimesMataMata: number
  vagasSobemPeloMataMata: number
  playoffRebaixamento: number
  jogosDentroGrupo: boolean
  rebaixadoPeloGrupo: boolean
  classificaPeloGeral: boolean
  melhoresTerceiros: boolean
  duasVoltasMataMata: boolean[]
  duasVoltasMataMataSobe: boolean[]
  duasVoltasPlayoffReb: boolean[]
}

/** est.ConfigEstadualType */
export interface ConfigEstadual {
  uf: number
  divisao: number
  formula: number
  nRebaixados: number
  desempate: number
  finaisIdaVolta: boolean[]
}

export interface Base {
  paises: Pais[]
  ufs: Uf[]
  times: Time[]
  ligas: ConfigLiga[]
  estaduais: ConfigEstadual[]
  /** options.bcf do original, getters em camelCase */
  opcoes: Record<string, unknown>
  /** código do país → nomes e sobrenomes (repetições mantidas: pesam no sorteio) */
  nomes: Record<string, { nomes: string[]; sobrenomes: string[] }>
}
