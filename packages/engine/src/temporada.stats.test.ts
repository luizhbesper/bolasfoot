import { describe, expect, it } from 'vitest'
import { simularTemporadas } from './estatisticas.ts'
import ref from './ref-temporadas.json' with { type: 'json' }

// Gate da Fase 2: temporadas completas pelo caminho da rodada, contra o original (tools/temporadas.sh → ref-temporadas.json).
// A força dos 11 melhores sobe ~1,8 por temporada na Série A no original também; o port tem de acompanhar.
describe('temporadas contra o original', () => {
  it('3 temporadas: força por divisão, idade e elencos na faixa do original', () => {
    const r = simularTemporadas(3, 'stats')
    r.forEach((x, t) => {
      const [a, b, c, fora] = x.forcaTop11
      expect(Math.abs(a - ref.forcaTop11.A[t]!)).toBeLessThan(2.5)
      expect(Math.abs(b - ref.forcaTop11.B[t]!)).toBeLessThan(2.5)
      expect(Math.abs(c - ref.forcaTop11.C[t]!)).toBeLessThan(2.5)
      expect(Math.abs(fora - ref.forcaTop11.fora[t]!)).toBeLessThan(2.5)
      expect(Math.abs(x.idadeMedia - ref.idadeMedia[t]!)).toBeLessThan(0.3)
      // sem os espanhóis (decisão da F0), uns 400 jogadores a menos
      expect(x.ativos / ref.ativos[t]!).toBeGreaterThan(0.94)
      expect(x.ativos / ref.ativos[t]!).toBeLessThan(1.02)
      expect(x.spearmanA).toBeGreaterThan(0.2)
      expect(x.golsJogo).toBeGreaterThan(2.3)
      expect(x.golsJogo).toBeLessThan(3.2)
    })
  }, 30_000)
})
