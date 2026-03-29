'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lookupCode, setLookupCode] = useState('')
  const [tab, setTab] = useState<'login' | 'lookup'>('login')

  const handleAuth = async () => {
    setError(''); setLoading(true)
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
        if (error) throw error
        // After signup, redirect to panel
        window.location.href = '/panel'
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = '/panel'
      }
    } catch (e: any) { setError(e.message || 'Error de autenticación') }
    setLoading(false)
  }

  const handleLookup = () => {
    if (lookupCode.trim()) window.location.href = `/panel?code=${lookupCode.trim().toUpperCase()}`
  }

  return (
    <div className="min-h-screen bg-[#0c1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#132828] border border-[#1e3838] p-6">
        <div className="text-center mb-6">
          <a href="/" className="inline-block mb-4">
            <span className="font-display text-2xl font-semibold text-[#dcc07a]">Rieck</span>
            <span className="block text-[.5rem] tracking-[.3em] uppercase text-white opacity-90">Glow Days & Nights</span>
          </a>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e3838] mb-6">
          <button onClick={() => setTab('login')} className={`flex-1 pb-2 text-xs tracking-widest uppercase transition-all ${tab === 'login' ? 'text-[#c5a55a] border-b-2 border-gold' : 'text-white/30'}`}>Ingresar</button>
          <button onClick={() => setTab('lookup')} className={`flex-1 pb-2 text-xs tracking-widest uppercase transition-all ${tab === 'lookup' ? 'text-[#c5a55a] border-b-2 border-gold' : 'text-white/30'}`}>Buscar Reserva</button>
        </div>

        {tab === 'login' ? (
          <div>
            <h2 className="font-display text-lg font-medium text-[#f5f0e0] mb-4">{isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
            {isRegister && (
              <input placeholder="Nombre completo" value={name} onChange={e => setName(e.target.value)}
                className="w-full p-2.5 mb-3 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-gold placeholder:text-white/20" />
            )}
            <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full p-2.5 mb-3 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-gold placeholder:text-white/20" />
            <input placeholder="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full p-2.5 mb-4 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-gold placeholder:text-white/20"
              onKeyDown={e => { if (e.key === 'Enter') handleAuth() }} />
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 mb-4">{error}</div>}
            <button onClick={handleAuth} disabled={loading}
              className="w-full p-3 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50">
              {loading ? 'Cargando...' : isRegister ? 'Registrarme' : 'Ingresar'}
            </button>
            <button onClick={() => { setIsRegister(!isRegister); setError('') }}
              className="block w-full text-center text-xs text-white/30 mt-3 hover:text-[#dcc07a] transition-colors">
              {isRegister ? '¿Ya tenés cuenta? Ingresá' : '¿No tenés cuenta? Registrate'}
            </button>
          </div>
        ) : (
          <div>
            <h2 className="font-display text-lg font-medium text-[#f5f0e0] mb-2">Buscar mi Reserva</h2>
            <p className="text-xs text-white/40 mb-4">Ingresá tu código de reserva (ej: RGD-ABC123)</p>
            <input placeholder="RGD-XXXXXX" value={lookupCode} onChange={e => setLookupCode(e.target.value.toUpperCase())}
              className="w-full p-2.5 mb-4 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-gold placeholder:text-white/20 tracking-wider font-mono"
              onKeyDown={e => { if (e.key === 'Enter') handleLookup() }} />
            <button onClick={handleLookup}
              className="w-full p-3 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold hover:shadow-lg transition-all">
              Buscar Reserva
            </button>
          </div>
        )}

        <a href="/" className="block text-center text-xs text-white/20 mt-6 hover:text-[#dcc07a] transition-colors">← Volver al sitio</a>
      </div>
    </div>
  )
}
