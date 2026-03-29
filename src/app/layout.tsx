import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rieck Glow Days & Nights',
  description: 'Sistema de reservas y afiliados',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>
}
