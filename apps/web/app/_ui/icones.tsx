// Ícones de traço (24×24, currentColor). Um arquivo só, sem lib.
const PATHS = {
  caixa: 'M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z',
  hub: 'M3 11l9-7 9 7v9H3z',
  elenco: 'M9 4.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.8 3 2.6 3.5 5.2',
  escalacao: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM3 12h18M12 9a3 3 0 110 6 3 3 0 010-6z',
  treino: 'M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12',
  juniores: 'M12 21V11M12 11c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z',
  partida: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 7l4 3-1.5 5h-5L8 10z',
  tabelas: 'M4 5h16M4 10h16M4 15h16M4 20h16',
  agenda: 'M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 10h18M8 3v4M16 3v4',
  procura: 'M11 4.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM16 16l5 5',
  leiloes: 'M14 4l6 6M11 7l6 6M8 10l6 6M4 20l7-7',
  propostas: 'M4 12h16M14 6l6 6-6 6',
  financas: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  estadio: 'M3 9c0-2.2 4-4 9-4s9 1.8 9 4-4 4-9 4-9-1.8-9-4zM3 9v6c0 2.2 4 4 9 4s9-1.8 9-4V9',
  times: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  historia: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4c0 3 1.5 4.5 3.5 4.5M17 6h3c0 3-1.5 4.5-3.5 4.5',
  transferencias: 'M4 8h14l-3-3M20 16H6l3 3',
  carteira: 'M5 6h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zM16 12.5h2',
  sair: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  seta: 'M9 6l6 6-6 6',
  voltar: 'M15 6l-6 6 6 6',
  ok: 'M5 12l5 5 9-10',
  alerta: 'M12 3l10 18H2zM12 10v5M12 18v.5',
} as const

export type NomeIcone = keyof typeof PATHS

export function Icone({ nome, tamanho = 16 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[nome]} />
    </svg>
  )
}
