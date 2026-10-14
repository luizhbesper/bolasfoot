// SSE do jogo: boas-vindas com o estado atual e o relógio do servidor, depois cada mudança. Reconectar = novo GET.
import { membroAtual } from '../../../../../lib/auth/sessao.ts'
import { db } from '../../../../../lib/db/index.ts'
import { ouvir, type EventoJogo } from '../../../../../lib/game/canal.ts'
import { batida as marcarBatida, estadoFase, prontos } from '../../../../../lib/game/rodada.ts'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gameId = Number((await params).id)
  const ctx = await membroAtual(gameId)
  if (!ctx) return new Response(null, { status: 401 })
  const viva = () => marcarBatida(db(), ctx.membro.id).catch(() => {})
  const enc = new TextEncoder()
  let fechar = () => {}
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      const enviar = (e: EventoJogo | { tipo: 'ola'; serverNow: number }) => {
        try {
          c.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))
        } catch {
          fechar() // cliente sumiu antes do abort
        }
      }
      enviar({ tipo: 'ola', serverNow: Date.now() })
      await viva()
      enviar(await estadoFase(db(), gameId))
      enviar(await prontos(db(), gameId))
      const sair = ouvir(gameId, enviar)
      const batida = setInterval(() => {
        enviar({ tipo: 'ola', serverNow: Date.now() })
        void viva()
      }, 15_000)
      fechar = () => {
        sair()
        clearInterval(batida)
        try {
          c.close()
        } catch {
          // já fechado
        }
      }
      req.signal.addEventListener('abort', fechar)
    },
    cancel: () => fechar(),
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } })
}
