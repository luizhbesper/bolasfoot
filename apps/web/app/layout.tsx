import { Bricolage_Grotesque, Geist } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-bricolage' })

export const metadata = { title: 'Bolasfoot' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  )
}
