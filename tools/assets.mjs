// Copia os assets do original/ (tools/extract.sh) para apps/web/public/assets com nomes estáveis (NFC).
// Uso: pnpm assets   — apaga e recria o destino, então é idempotente.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const ORIG = join(ROOT, 'original')
const DEST = join(ROOT, 'apps/web/public/assets')

// origem (em original/) → destino (em public/assets)
const MAP = {
  'game/teams/escudos': 'escudos',
  'game/teams/escudosMini': 'escudos-mini',
  'game/teams/camisas': 'camisas/1',
  'game/teams/camisas2': 'camisas/2',
  'game/teams/camisas3': 'camisas/3',
  'res/acamisas': 'camisas/genericas',
  'game/selecoes/escudos': 'selecoes/escudos',
  'game/selecoes/camisas': 'selecoes/camisas/1',
  'game/selecoes/camisas2': 'selecoes/camisas/2',
  'res/aflags': 'bandeiras/20',
  'res/aflagslarge': 'bandeiras/36',
  'res/aicons': 'icones/icons',
  'res/aiconsb': 'icones/iconsb',
  'res/aiconsc': 'icones/iconsc',
  'res/aiconsj': 'icones/iconsj',
  'res/aeicons': 'icones/eicons',
  'res/aesticons': 'icones/esticons',
  'game/sons': 'sons',
  'game/trofeus': 'trofeus',
  'game/img': 'img',
}
const KEEP = /\.(png|jpe?g|gif|wav)$/i

// 7-Zip jogou bytes Latin-1 em U+EFxx (puskás → pusk\uEFE1s); o .rar do mod traz os acentos em NFD (sãoraimundoam_br)
const nfc = (f) => f.replace(/[\uEF80-\uEFFF]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xef00)).normalize('NFC')
// o Windows ignora caixa, a web não: TR_copa_EGI, tr_estadual_RS_D1, tr_nacional_tur → tr_copa_EGI, tr_estadual_RS_d1, tr_nacional_TUR
const trofeu = (f) => nfc(f).replace(/^TR_/, 'tr_').replace(/_D(\d)/, '_d$1').replace(/_tur(?=[_.])/, '_TUR')

rmSync(DEST, { recursive: true, force: true })
let n = 0
for (const [from, to] of Object.entries(MAP)) {
  mkdirSync(join(DEST, to), { recursive: true })
  for (const f of readdirSync(join(ORIG, from))) {
    if (!KEEP.test(f)) continue
    const name = to === 'trofeus' ? trofeu(f) : nfc(f).replace(/^flag_/, '') // bandeiras grandes: flag_29.png → 29.png
    cpSync(join(ORIG, from, f), join(DEST, to, name))
    n++
  }
}

// Mod "Projeto Brasfoot julho/26" (docs/fase7.md), extraído para data-cache/mod26. Não sobrescreve o original, salvo os sons.
// `nome` devolve o nome no destino, ou null para pular.
const MOD = join(ROOT, 'data-cache/mod26')
function doMod(from, to, nome, sobrescreve = false) {
  if (!existsSync(join(MOD, from))) return
  for (const f of readdirSync(join(MOD, from))) {
    const destino = KEEP.test(f) && nome(f) && join(DEST, to, nome(f))
    if (!destino || (!sobrescreve && existsSync(destino))) continue
    cpSync(join(MOD, from, f), destino)
    n++
  }
}
doMod('trofeus', 'trofeus', trofeu) // 296 contra 72
doMod('img', 'img', (f) => (/^e\d+\.jpg$/.test(f) ? f : null)) // fundos de estádio e01–e16; o f03 do mod é o f01 do original
doMod('sons', 'sons', nfc, true) // 44,1 kHz estéreo e mais longos; os do original têm 8 kHz e até 0,1 s
// escudos e camisas dos clubes das duas bases que o original não tem (a 2022 tem 365 sem camisa própria)
const refs = new Set(['base.json', 'base-2026.json'].flatMap((b) => JSON.parse(readFileSync(join(ROOT, 'packages/data', b), 'utf8')).times.map((t) => t.fileRef)))
const ALIAS = { deportivocuenca_equ: 'depcuenca_equ', union_bel: 'unionsaintgilloise_bel' } // nome no mod → fileRef da base
const DO_MOD = { escudos: 'escudos', escudosMini: 'escudos-mini', camisas: 'camisas/1', camisas2: 'camisas/2', camisas3: 'camisas/3' }
for (const [from, to] of Object.entries(DO_MOD)) doMod(`teams/${from}`, to, (f) => {
  const ref = nfc(f).replace(/\.png$/i, '')
  return refs.has(ALIAS[ref] ?? ref) ? `${ALIAS[ref] ?? ref}.png` : null
})

// o aq.w do original (o troféu existe?) para o trofeu.tsx
const trofeus = readdirSync(join(DEST, 'trofeus')).map((f) => f.replace(/\.png$/, '')).sort()
writeFileSync(join(ROOT, 'apps/web/app/_ui/trofeus.json'), JSON.stringify(trofeus) + '\n')
console.log(`${n} assets em ${DEST}`)
