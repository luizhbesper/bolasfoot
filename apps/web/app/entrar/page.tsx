import Link from 'next/link'
import { entrarAcao } from '../acoes-conta.ts'

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  return (
    <main>
      <h1>Entrar</h1>
      {erro && <p role="alert">{erro}</p>}
      <form action={entrarAcao}>
        <label>Usuário <input name="usuario" autoComplete="username" required /></label>
        <label>Senha <input name="senha" type="password" autoComplete="current-password" /></label>
        <button>Entrar</button>
      </form>
      <p><Link href="/convite">Tenho um código de convite</Link></p>
    </main>
  )
}
