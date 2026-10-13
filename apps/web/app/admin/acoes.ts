'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigirAdmin } from '../../lib/auth/sessao.ts'
import { db } from '../../lib/db/index.ts'
import type { ModoJogo } from '../../lib/db/schema.ts'
import { apagarJogo, criarJogo, editarSettings, expulsar, gerarConvite, revogarConvite } from '../../lib/game/admin.ts'
import { iniciarEscolha } from '../../lib/game/escolha.ts'
import { pausar, retomar, transicionar } from '../../lib/game/rodada.ts'

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const num = (f: FormData, k: string) => Number(txt(f, k))
const id = (f: FormData) => num(f, 'jogo')
const voltar = (g: number, erro?: string) => {
  revalidatePath(`/admin/${g}`)
  redirect(`/admin/${g}` + (erro ? '?erro=' + encodeURIComponent(erro) : ''))
}

export async function criarJogoAcao(f: FormData) {
  const u = await exigirAdmin()
  const g = await criarJogo(db(), u.id, txt(f, 'nome'), txt(f, 'modo') === 'daily' ? 'daily' : ('live' satisfies ModoJogo), {
    habilidadeIndividual: f.get('habilidadeIndividual') === 'on',
    salarioMensal: f.get('salarioSemanal') !== 'on',
    proibidos: txt(f, 'proibidos').split(/[\s,]+/).filter(Boolean),
    divisoes: f.getAll('divisoes').map(Number),
  })
  redirect(`/admin/${g}`)
}

export async function conviteAcao(f: FormData) {
  const u = await exigirAdmin()
  await gerarConvite(db(), id(f), u.id, num(f, 'usos') || 1, num(f, 'horas') || null)
  voltar(id(f))
}

export async function revogarAcao(f: FormData) {
  await exigirAdmin()
  await revogarConvite(db(), txt(f, 'codigo'))
  voltar(id(f))
}

export async function settingsAcao(f: FormData) {
  await exigirAdmin()
  const erro = await editarSettings(db(), id(f), {
    planningTimeoutS: num(f, 'planningTimeoutS'),
    halftimeTimeoutS: num(f, 'halftimeTimeoutS'),
    resultsPauseS: num(f, 'resultsPauseS'),
    msPerMinute: num(f, 'msPerMinute'),
    dailyResolveAt: txt(f, 'dailyResolveAt'),
    timezone: txt(f, 'timezone'),
    autoReadyOnTimeout: f.get('autoReadyOnTimeout') === 'on',
  })
  voltar(id(f), erro ?? undefined)
}

export async function expulsarAcao(f: FormData) {
  await exigirAdmin()
  await expulsar(db(), id(f), num(f, 'membro'))
  voltar(id(f))
}

export async function apagarAcao(f: FormData) {
  await exigirAdmin()
  if (txt(f, 'confirmar') !== 'apagar') voltar(id(f), 'digite "apagar" para confirmar')
  await apagarJogo(db(), id(f))
  revalidatePath('/admin')
  redirect('/admin')
}

export async function pausarAcao(f: FormData) {
  await exigirAdmin()
  await pausar(db(), id(f))
  voltar(id(f))
}

export async function retomarAcao(f: FormData) {
  await exigirAdmin()
  await retomar(db(), id(f))
  voltar(id(f))
}

export async function forcarAcao(f: FormData) {
  await exigirAdmin()
  await transicionar(db(), id(f), true)
  voltar(id(f))
}

export async function escolhaAcao(f: FormData) {
  await exigirAdmin()
  await iniciarEscolha(db(), id(f))
  voltar(id(f))
}
