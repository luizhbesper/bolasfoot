import { usuarioAtual } from '../../lib/auth/sessao.ts'
import { conviteAcao } from '../acoes-conta.ts'

export default async function Convite({ searchParams }: { searchParams: Promise<{ erro?: string; codigo?: string }> }) {
  const { erro, codigo } = await searchParams
  const u = await usuarioAtual()
  return (
    <main>
      <h1>Tenho um código</h1>
      {erro && <p role="alert">{erro}</p>}
      <form action={conviteAcao}>
        <label>Código <input name="codigo" defaultValue={codigo} required /></label>
        {u ? (
          <p>Entrando como {u.username}.</p>
        ) : (
          <>
            <p>Sem conta, ela é criada agora. Já tem conta? Use o mesmo usuário e senha.</p>
            <label>Usuário <input name="usuario" autoComplete="username" required /></label>
            <label>Senha <input name="senha" type="password" autoComplete="new-password" /></label>
          </>
        )}
        <button>Entrar no jogo</button>
      </form>
    </main>
  )
}
