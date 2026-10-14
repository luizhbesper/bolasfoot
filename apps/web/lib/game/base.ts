// As bases de times e jogadores, carregadas uma vez por processo (docs/fase7.md, B1).
import type { Base } from '@bolasfoot/data'
import json from '@bolasfoot/data/base.json' with { type: 'json' }
import type { ConfigJogo } from '../db/schema.ts'

/** Bases disponíveis; a 2026 entra quando o importador (B3) gerar o arquivo. */
export const bases: Record<string, Base> = { '2022': json as Base }

/** A 2022. Serve onde só importam `paises` e `ufs`, que são os mesmos em todas as bases. */
export const base = bases['2022']!

/** A base do jogo; jogo criado antes da F7 não tem o campo e usa a 2022. */
export function baseDe(cfg: Pick<ConfigJogo, 'base'>): Base {
  const b = bases[cfg.base ?? '2022']
  if (!b) throw new Error(`base ${cfg.base} não existe`)
  return b
}
