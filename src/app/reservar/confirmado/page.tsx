'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ConfirmadoContent() {
  const searchParams = useSearchParams()
  const code = searchParams.get('code') || ''
  const status = searchParams.get('status') || 'success'
  const [reserva, setReserva] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showGift, setShowGift] = useState(false)
  const [showModify, setShowModify] = useState(false)
  const [giftName, setGiftName] = useState('')
  const [giftPhone, setGiftPhone] = useState('')
  const [giftEmail, setGiftEmail] = useState('')
  const [newDate, setNewDate] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const fm = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

  useEffect(() => {
    if (code) {
      fetch(`/api/reservas?code=${code}`).then(r => r.json()).then(d => {
        if (d.reserva) setReserva(d.reserva)
        setLoading(false)
      }).catch(() => setLoading(false))
    } else setLoading(false)
  }, [code])

  const handleGift = async () => {
    if (!giftName.trim()) { setError('Ingresá el nombre del destinatario'); return }
    setError('')
    const res = await fetch('/api/reservas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, action: 'gift', gift_name: giftName, gift_phone: giftPhone, gift_email: giftEmail })
    })
    const data = await res.json()
    if (data.error) { setError(data.error); return }
    setMsg('¡Reserva regalada exitosamente!')
    setShowGift(false)
    // Reload
    const r = await fetch(`/api/reservas?code=${code}`).then(r => r.json())
    if (r.reserva) setReserva(r.reserva)
  }

  const handleModify = async () => {
    if (!newDate) { setError('Seleccioná una nueva fecha'); return }
    setError('')
    const res = await fetch('/api/reservas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, action: 'change_date', new_date: newDate })
    })
    const data = await res.json()
    if (data.error) { setError(data.error); return }
    setMsg('¡Fecha modificada exitosamente!')
    setShowModify(false)
    const r = await fetch(`/api/reservas?code=${code}`).then(r => r.json())
    if (r.reserva) setReserva(r.reserva)
  }

  if (loading) return <div className="min-h-screen bg-[#0c1a1a] flex items-center justify-center"><div className="text-[#c5a55a] font-display text-xl animate-pulse">Cargando...</div></div>
  if (!reserva) return <div className="min-h-screen bg-[#0c1a1a] flex items-center justify-center"><div className="text-center"><p className="text-white/40">Reserva no encontrada.</p><a href="/" className="text-[#c5a55a] text-sm mt-4 block">Volver al sitio</a></div></div>

  const isPaid = reserva.status === 'paid' || status === 'success'
  const isFailed = status === 'failure'
  const isPending = status === 'pending' || reserva.status === 'pending'
  const isDeposit = reserva.payment_type === 'deposit'
  const remaining = reserva.amount_remaining || 0

  return (
    <div className="min-h-screen bg-[#0c1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#132828] border border-[#1e3838] p-6 md:p-8">
        <div className="text-center mb-6">
          <a href="/" className="inline-block mb-4"><span className="font-display text-2xl font-semibold text-[#dcc07a]">Rieck</span><span className="block text-[.5rem] tracking-[.3em] uppercase text-white/80">Glow Days & Nights</span></a>
        </div>

        {/* Status icon */}
        <div className="text-center mb-4">
          {isPaid && <div className="text-5xl mb-3">✅</div>}
          {isFailed && <div className="text-5xl mb-3">❌</div>}
          {isPending && !isPaid && !isFailed && <div className="text-5xl mb-3">⏳</div>}
          <h2 className="font-display text-2xl font-medium text-[#f5f0e0]">
            {isPaid ? '¡Reserva Confirmada!' : isFailed ? 'Pago no procesado' : 'Reserva Pendiente'}
          </h2>
          {isFailed && <p className="text-sm text-red-400 mt-2">El pago no se pudo procesar. Podés intentar nuevamente.</p>}
          {isPending && !isFailed && <p className="text-sm text-yellow-400 mt-2">Tu pago está siendo procesado.</p>}
        </div>

        {/* Reservation code */}
        <div className="bg-[#c5a55a]/10 border border-[#c5a55a]/20 p-4 mb-4 text-center">
          <div className="text-[.6rem] tracking-widest uppercase text-white/30 mb-1">Código de reserva</div>
          <div className="font-display text-3xl font-bold text-[#dcc07a] tracking-wider">{reserva.code}</div>
        </div>

        {/* Details */}
        <div className="bg-black/20 border border-[#1e3838] p-4 text-xs space-y-1 mb-4">
          <div className="flex justify-between"><span className="text-white/40">Experiencia</span><strong className="text-[#f5f0e0]">{reserva.experience}</strong></div>
          <div className="flex justify-between"><span className="text-white/40">Fecha</span><strong className="text-[#f5f0e0]">{new Date(reserva.date + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong></div>
          <div className="flex justify-between"><span className="text-white/40">Personas</span><strong className="text-[#f5f0e0]">{reserva.adults}{reserva.children > 0 ? ` + ${reserva.children} niños` : ''}</strong></div>
          <div className="flex justify-between"><span className="text-white/40">Nombre</span><strong className="text-[#f5f0e0]">{reserva.user_name}</strong></div>
          <div className="border-t border-dashed border-[#1e3838] my-2" />
          <div className="flex justify-between"><span className="text-white/40">Total</span><strong className="text-[#f5f0e0]">{fm(reserva.total)}</strong></div>
          {isDeposit && <>
            <div className="flex justify-between text-green-400"><span>Seña abonada</span><span>{fm(reserva.amount_paid || (reserva.total - remaining))}</span></div>
            <div className="flex justify-between text-yellow-400"><span>Resta abonar en el lugar</span><span>{fm(remaining)}</span></div>
          </>}
          {reserva.is_gift && <div className="border-t border-dashed border-[#1e3838] my-2" />}
          {reserva.is_gift && <div className="flex justify-between"><span className="text-pink-400">🎁 Regalado a</span><strong className="text-pink-300">{reserva.gifted_to_name}</strong></div>}
          {reserva.affiliate_code_used && <div className="flex justify-between"><span className="text-white/20">Código promo</span><span className="text-white/20">{reserva.affiliate_code_used}</span></div>}
        </div>

        {/* Success message */}
        {msg && <div className="bg-green-400/10 border border-green-400/20 text-green-400 text-xs p-3 mb-4 text-center">{msg}</div>}
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 mb-4 text-center">{error}</div>}

        {/* Actions */}
        <div className="space-y-2">
          {/* Retry payment if failed */}
          {(isFailed || (isPending && reserva.mp_init_point)) && (
            <a href={reserva.mp_init_point} className="block w-full p-3 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold text-center">Reintentar Pago</a>
          )}

          {/* WhatsApp confirmation */}
          <a href={'https://wa.me/5491163065144?text=' + encodeURIComponent('🎫 RESERVA RIECK: ' + reserva.code + '\n' + reserva.experience + '\n' + reserva.adults + ' personas · Total: ' + fm(reserva.total) + (isDeposit ? '\nSeña: ' + fm(reserva.total - remaining) + ' · Resto: ' + fm(remaining) : '') + '\n\n¡Quiero confirmar!')} target="_blank" className="block w-full p-3 border border-green-400/20 text-green-400 text-sm text-center hover:bg-green-400/5">
            💬 Contactar por WhatsApp
          </a>

          {/* Modify date */}
          {(isPaid || isPending) && !showModify && (
            <button onClick={() => { setShowModify(true); setShowGift(false); setError('') }} className="block w-full p-3 border border-[#1e3838] text-white/40 text-sm text-center hover:border-[#c5a55a] hover:text-[#c5a55a] cursor-pointer">
              📅 Cambiar fecha {reserva.modification_count > 0 ? `(${reserva.modification_count} usada${reserva.modification_count > 1 ? 's' : ''})` : ''}
            </button>
          )}

          {showModify && <div className="border border-[#1e3838] p-4 space-y-3">
            <div className="text-xs text-white/40">Seleccioná la nueva fecha:</div>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} min={new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10)} className="w-full p-2 bg-[#0f2020] border border-[#1e3838] text-[#f5f0e0] text-sm outline-none focus:border-[#c5a55a]" />
            <div className="flex gap-2">
              <button onClick={() => setShowModify(false)} className="flex-1 p-2 border border-[#1e3838] text-white/40 text-xs">Cancelar</button>
              <button onClick={handleModify} className="flex-1 p-2 bg-[#c5a55a]/10 text-[#c5a55a] text-xs border border-[#c5a55a]/20">Confirmar Cambio</button>
            </div>
          </div>}

          {/* Gift */}
          {(isPaid) && !showGift && !reserva.is_gift && (
            <button onClick={() => { setShowGift(true); setShowModify(false); setError('') }} className="block w-full p-3 border border-[#1e3838] text-white/40 text-sm text-center hover:border-pink-400 hover:text-pink-400 cursor-pointer">
              🎁 Regalar esta reserva
            </button>
          )}

          {showGift && <div className="border border-pink-400/20 p-4 space-y-3 bg-pink-400/5">
            <div className="text-xs text-pink-300">¿A quién le regalás la experiencia?</div>
            <input placeholder="Nombre completo" value={giftName} onChange={e => setGiftName(e.target.value)} className="w-full p-2 bg-[#0f2020] border border-[#1e3838] text-[#f5f0e0] text-sm outline-none focus:border-pink-400 placeholder:text-white/20" />
            <input placeholder="WhatsApp (opcional)" value={giftPhone} onChange={e => setGiftPhone(e.target.value)} className="w-full p-2 bg-[#0f2020] border border-[#1e3838] text-[#f5f0e0] text-sm outline-none focus:border-pink-400 placeholder:text-white/20" />
            <input placeholder="Email (opcional)" value={giftEmail} onChange={e => setGiftEmail(e.target.value)} className="w-full p-2 bg-[#0f2020] border border-[#1e3838] text-[#f5f0e0] text-sm outline-none focus:border-pink-400 placeholder:text-white/20" />
            <div className="flex gap-2">
              <button onClick={() => setShowGift(false)} className="flex-1 p-2 border border-[#1e3838] text-white/40 text-xs">Cancelar</button>
              <button onClick={handleGift} className="flex-1 p-2 bg-pink-400/10 text-pink-400 text-xs border border-pink-400/20">Confirmar Regalo</button>
            </div>
          </div>}

          {/* Copy link */}
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copiado!') }} className="block w-full p-3 border border-[#1e3838] text-white/30 text-sm text-center hover:border-[#c5a55a] cursor-pointer">
            📋 Copiar link de mi reserva
          </button>

          <a href="/" className="block text-center text-xs text-white/20 hover:text-[#dcc07a] mt-4">← Volver al sitio</a>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmadoPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#0c1a1a] flex items-center justify-center"><div className="text-[#c5a55a] font-display text-xl animate-pulse">Cargando...</div></div>}>
    <ConfirmadoContent />
  </Suspense>
}
