// RNG do motor: sfc32 com seed de 128 bits derivada de string (cyrb128).
// API imita java.util.Random para o port ficar legível linha a linha.

/** Hash de string → 4 inteiros de 32 bits (cyrb128). */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

export type EstadoRng = [number, number, number, number]

export class Rng {
  private a: number
  private b: number
  private c: number
  private d: number

  constructor(estado: EstadoRng) {
    ;[this.a, this.b, this.c, this.d] = estado
  }

  /** Próximo uint32 (sfc32). */
  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0
    this.d = (this.d + 1) | 0
    this.a = this.b ^ (this.b >>> 9)
    this.b = (this.c + (this.c << 3)) | 0
    this.c = (this.c << 21) | (this.c >>> 11)
    this.c = (this.c + t) | 0
    return t >>> 0
  }

  /** nextDouble(): [0, 1) com 53 bits. */
  float(): number {
    return ((this.next() >>> 5) * 67108864 + (this.next() >>> 6)) / 9007199254740992
  }

  /** nextInt(n): inteiro em [0, n). */
  int(n: number): number {
    if (!(n > 0)) throw new Error(`int(${n}): n precisa ser > 0`)
    return Math.floor(this.float() * n)
  }

  /** nextBoolean() */
  bool(): boolean {
    return (this.next() & 1) === 1
  }

  /** Collections.shuffle (Fisher–Yates), no lugar. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
    }
    return arr
  }

  /** Índice sorteado por pesos[i]·mult[i]; length se nada for escolhido. Fonte: c/b.java:590 */
  ponderado(pesos: readonly number[], mult?: readonly number[]): number {
    const p = mult ? pesos.map((x, i) => x * mult[i]!) : pesos
    let total = 0
    for (const x of p) total += x
    const r = this.float() * total
    let acc = 0
    for (let i = 0; i < p.length; i++) if (r < (acc += p[i]!)) return i
    return p.length
  }

  estado(): EstadoRng {
    return [this.a, this.b, this.c, this.d]
  }
}

export function criarRng(seed: string): Rng {
  const rng = new Rng(cyrb128(seed))
  for (let i = 0; i < 12; i++) rng.next() // aquece o estado
  return rng
}

/** Stream independente por subsistema: mudar um não embaralha os outros. */
export function derivar(seed: string, rotulo: string): Rng {
  return criarRng(`${seed}:${rotulo}`)
}
