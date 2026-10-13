// Senha sem regra de força, guardada com scrypt (docs/plano.md §2.4).
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (senha: string, salt: Buffer, tamanho: number) => Promise<Buffer>

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('hex')}$${(await scryptAsync(senha, salt, 64)).toString('hex')}`
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [alg, salt, hash] = guardado.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const esperado = Buffer.from(hash, 'hex')
  return timingSafeEqual(await scryptAsync(senha, Buffer.from(salt, 'hex'), esperado.length), esperado)
}
