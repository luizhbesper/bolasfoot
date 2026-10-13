import Link from 'next/link'
import { usuarioAtual } from '../../lib/auth/sessao.ts'
import { Erro, Pagina } from '../_ui/pagina.tsx'
import { conviteAcao } from '../acoes-conta.ts'

export default async function Convite({ searchParams }: { searchParams: Promise<{ erro?: string; codigo?: string }> }) {
  const { erro, codigo } = await searchParams
  const u = await usuarioAtual()
  return (
    <Pagina estreita usuario={u}>
      <h1>Tenho um código</h1>
      <Erro texto={erro} />
      <form action={conviteAcao} className="form card secao">
        <label>Código do convite <input name="codigo" defaultValue={codigo} placeholder="K7QX-2M" required autoFocus
          autoCapitalize="characters" style={{ letterSpacing: '0.1em', fontWeight: 600 }} /></label>
        {u ? (
          <p className="mudo" style={{ margin: 0 }}>Entrando como <strong>{u.username}</strong>.</p>
        ) : (
          <>
            <p className="mudo" style={{ margin: 0 }}>Sem conta, ela é criada agora. Já tem conta? Use o mesmo usuário e senha.</p>
            <label>Usuário <input name="usuario" autoComplete="username" required /></label>
            <label>Senha <input name="senha" type="password" autoComplete="new-password" /></label>
          </>
        )}
        <button className="primario">Entrar no jogo</button>
      </form>
      {!u && <p className="mudo">Já joga? <Link href="/entrar">Entrar</Link></p>}
    </Pagina>
  )
}
