// Copia os assets do original/ (tools/extract.sh) para apps/web/public/assets com nomes estáveis (NFC).
// Uso: pnpm assets   — apaga e recria o destino, então é idempotente.
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
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

rmSync(DEST, { recursive: true, force: true })
let n = 0
for (const [from, to] of Object.entries(MAP)) {
  mkdirSync(join(DEST, to), { recursive: true })
  for (const f of readdirSync(join(ORIG, from))) {
    if (!KEEP.test(f)) continue
    const name = f
      .replace(/[\uEF80-\uEFFF]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xef00)) // 7-Zip jogou bytes Latin-1 em U+EFxx (puskás → pusk\uEFE1s)
      .normalize('NFC')
      .replace(/^flag_/, '') // bandeiras grandes: flag_29.png → 29.png
    cpSync(join(ORIG, from, f), join(DEST, to, name))
    n++
  }
}
console.log(`${n} assets em ${DEST}`)
