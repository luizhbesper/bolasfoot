// Moldura das telas fora do jogo (seus jogos, admin, entrar, convite): marca, usuário e conteúdo centralizado.
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Usuario } from '../../lib/auth/sessao.ts'
import { sairAcao } from '../acoes-conta.ts'
import { Avatar } from './ui.tsx'
import s from './pagina.module.css'

export function Pagina({ usuario, estreita, extra, children }: {
  usuario?: Usuario | null; estreita?: boolean; extra?: ReactNode; children: ReactNode
}) {
  return (
    <div className={s.pagina}>
      <header className={s.topo}>
        <Link href="/" className={s.marca}>Bolasfoot</Link>
        {extra}
        {usuario && (
          <nav className={s.usuario} aria-label="Conta">
            <Link href="/convite">Tenho um código</Link>
            {usuario.isAdmin && <Link href="/admin">Admin</Link>}
            <Avatar nome={usuario.username} />
            <span>{usuario.username}</span>
            <form action={sairAcao}><button className={s.sair}>Sair</button></form>
          </nav>
        )}
      </header>
      <main className={estreita ? s.estreita : s.larga}>{children}</main>
    </div>
  )
}

/** Mensagem de erro vinda do `?erro=` das server actions. */
export function Erro({ texto }: { texto?: string }) {
  return texto ? <p role="alert" className={s.erro}>{texto}</p> : null
}
