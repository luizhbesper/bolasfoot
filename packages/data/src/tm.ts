// Transfermarkt para a base 2026 (docs/fase7.md). Lê o transfermarkt-api rodando local
// (`docker run -d -p 8000:8000 transfermarkt-api`), com cache em disco: cada resposta é baixada uma vez só.
// Uso privado: os dados brutos ficam em data-cache/ (gitignored).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Pais } from './types.ts'

const CACHE = new URL('../../../data-cache/tm-api/', import.meta.url)
const API = process.env.TM_API ?? 'http://localhost:8000'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tm<T = any>(path: string): Promise<T> {
  const f = new URL(path.replace(/[^\w.-]+/g, '_') + '.json', CACHE)
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'))
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch(API + path)
    if (r.ok) {
      const j = await r.json()
      mkdirSync(CACHE, { recursive: true })
      writeFileSync(f, JSON.stringify(j))
      return j
    }
    if (r.status === 404 || tentativa === 4) throw new Error(`TM ${path}: ${r.status}`)
    await new Promise((ok) => setTimeout(ok, 2000 * 2 ** tentativa)) // 503 = o TM recusou: espera e tenta de novo
  }
}

export const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Nomes do TM (inglês) que o Intl não traduz para o nome do original.
const PAIS_MANUAL: Record<string, string> = {
  England: 'ING', Scotland: 'ESC', Wales: 'PGA', 'Northern Ireland': 'IRN', Netherlands: 'HOL', 'Korea, South': 'CRS',
  'Korea, North': 'CRN', Türkiye: 'TUR', Turkey: 'TUR', 'Czech Republic': 'RTC', Czechia: 'RTC', "Cote d'Ivoire": 'COM',
  'DR Congo': 'RDG', Congo: 'CNG', 'Bosnia-Herzegovina': 'BOS', 'North Macedonia': 'MCD', 'United States': 'EUA',
  'Chinese Taipei': 'TAW', 'Cape Verde': 'CAV', Curacao: 'CUR', 'St. Kitts & Nevis': 'SCN', 'St. Lucia': 'STL',
  'St. Vincent & Grenadinen': 'SVG', 'The Gambia': 'GAM', Eswatini: 'ESS', 'Central African Republic': 'RCA',
  'Dominican Republic': 'RDO', 'Equatorial Guinea': 'GNE', 'Antigua and Barbuda': 'ATG', 'Hongkong': 'HKG',
  'Kyrgyzstan': 'QUI', 'Timor-Leste': 'TML', 'Southern Sudan': 'SUS', 'Moldova': 'MOL', 'Belarus': 'BIE',
  'Faroe Islands': 'IFA', 'Neukaledonien': 'NCA', 'New Caledonia': 'NCA', 'Tahiti': 'TTI', 'Macao': 'MAC',
}

/** Nome do país em inglês (como o TM escreve) → índice em `paises`; undefined se não achar. */
export function paisDoTm(paises: Pais[]): (nome: string) => number | undefined {
  const porNome = new Map(paises.map((p) => [norm(p.nome), p.id]))
  const porCodigo = new Map(paises.map((p) => [p.codigo, p.id]))
  const en = new Intl.DisplayNames('en', { type: 'region' })
  const pt = new Intl.DisplayNames('pt-BR', { type: 'region' })
  const m = new Map<string, number>()
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const iso = String.fromCharCode(a, b)
    const nomeEn = en.of(iso)
    const id = nomeEn && nomeEn !== iso ? porNome.get(norm(pt.of(iso) ?? '')) : undefined
    if (id !== undefined) m.set(norm(nomeEn!), id)
  }
  for (const [nome, codigo] of Object.entries(PAIS_MANUAL)) m.set(norm(nome), porCodigo.get(codigo)!)
  return (nome) => m.get(norm(nome))
}
