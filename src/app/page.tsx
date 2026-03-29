import { redirect } from 'next/navigation'

export default function HomePage() {
  // vercel.json rewrites / → /landing.html (static site)
  // If somehow Next catches this, redirect to reservar
  redirect('/reservar')
}
