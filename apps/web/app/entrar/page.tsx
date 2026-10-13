import Link from 'next/link'
import { Erro, Pagina } from '../_ui/pagina.tsx'
import { entrarAcao } from '../acoes-conta.ts'

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  return (
    <Pagina estreita>
      <h1>Entrar</h1>
      <Erro texto={erro} />
      <form action={entrarAcao} className="form card secao">
        <label>Usuário <input name="usuario" autoComplete="username" required autoFocus /></label>
        <label>Senha <input name="senha" type="password" autoComplete="current-password" /></label>
        <button className="primario">Entrar</button>
      </form>
      <p className="mudo">Recebeu um convite? <Link href="/convite">Entre com o código</Link></p>
    </Pagina>
  )
}
