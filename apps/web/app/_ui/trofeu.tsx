// Troféu de cada competição: o PNG que o mA() de cada competição do original escolhe, caindo nos genéricos quando o
// arquivo não existe. trofeus.json é a lista dos PNGs em public/assets/trofeus, gerada pelo `pnpm assets`.
import { ANO_INICIAL } from '@bolasfoot/engine'
import TROFEUS from './trofeus.json'
import s from './ui.module.css'

const existe = new Set<string>(TROFEUS)
/** aq.w(nome) ? nome : próximo; o último é o genérico, que sempre existe */
const primeiro = (...nomes: string[]) => nomes.find((n) => existe.has(n)) ?? nomes.at(-1)!

const FIXOS: Record<string, string> = {
  LIB: 'tr_libertadores', // f/r.java:678
  SUL: 'tr_sulamericana', // f/H.java:316
  RECOPA: 'tr_recopasulamaericana', // f/e_0.java:80 (sic)
  MUN: 'tr_mundial', // f/a_0.java:179
  UCL: 'tr_ligacampeoes', // f/v.java:631
  UEL: 'tr_ligaeuropa', // f/x.java:493
  UECL: 'tr_conference', // f/j_0.java:782
  'RECOPA-E': 'tr_recopaeuropa', // f/d_0.java:80
  CAF: 'tr_ligacaf', // f/t.java:195
  AFC: 'tr_ligaafc', // f/u.java:194
  CONCACAF: 'tr_ligaconcacaf', // f/w.java:176
  OFC: 'tr_ligaofc', // f/y.java:148
}
const REGIONAIS = ['tr_riosaopaulo', 'tr_sulminas', 'tr_copanordeste', 'tr_copaverde'] // f/F.java:139

/** Nome do PNG (sem extensão) do troféu da competição, pelo id do motor (BR-1, EST-SP-1, CB, LIB…). */
export function trofeu(competicao: string): string {
  if (FIXOS[competicao]) return FIXOS[competicao]
  const [tipo, a = '', b = ''] = competicao.split('-')
  switch (tipo) {
    case 'BR': // f/b_0.java:615
      return primeiro(`tr_nacional_BRA_d${a}`, ...(a === '1' ? ['tr_nacional_BRA'] : []), 'tr_nacionalgenerico')
    case 'EST': // f/o.java:143
      return primeiro(`tr_estadual_${a}_d${b}`, ...(b === '1' ? [`tr_estadual_${a}`] : []), 'tr_estadualgenerico')
    case 'REG':
      return primeiro(REGIONAIS[Number(a)] ?? '', 'tr_nacionalgenerico')
    case 'CB': // f/f_0.java:399
      return primeiro('tr_copa_BRA', 'tr_copa')
    case 'SUP': // f/I.java:96
      return primeiro(`tr_supercopa_${a}`, 'tr_supercopa_generico')
    default:
      return 'tr_copa'
  }
}

export function Trofeu({ competicao, tamanho = 32, titulo }: { competicao: string; tamanho?: number; titulo?: string }) {
  // os PNGs têm 70–86 × 121
  return <img className={s.trofeu} src={`/assets/trofeus/${trofeu(competicao)}.png`} alt={titulo ?? ''} title={titulo} width={Math.round(tamanho * 0.71)} height={tamanho} />
}

/** Títulos agrupados por troféu, com a contagem e os anos no título. */
export function SalaDeTrofeus({ titulos }: { titulos: { competicao: string; nome: string; temporada: number }[] }) {
  if (!titulos.length) return <p className="fraco" style={{ margin: 0, fontSize: 13 }}>Nenhum título ainda.</p>
  const grupos = new Map<string, { nome: string; anos: number[] }>()
  for (const t of titulos) {
    const g = grupos.get(t.competicao) ?? grupos.set(t.competicao, { nome: t.nome, anos: [] }).get(t.competicao)!
    g.anos.push(ANO_INICIAL + t.temporada - 1)
  }
  return (
    <ul className={s.sala}>
      {[...grupos].sort((x, y) => y[1].anos.length - x[1].anos.length).map(([id, g]) => (
        <li key={id} title={`${g.nome}: ${g.anos.sort().join(', ')}`}>
          <Trofeu competicao={id} tamanho={48} />
          <span className={s.vezes}>{g.anos.length}×</span>
          <span className={s.nomeTrofeu}>{g.nome}</span>
        </li>
      ))}
    </ul>
  )
}
