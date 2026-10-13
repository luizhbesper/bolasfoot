// A base de times e jogadores, carregada uma vez por processo.
import type { Base } from '@bolasfoot/data'
import json from '@bolasfoot/data/base.json' with { type: 'json' }

export const base = json as Base
