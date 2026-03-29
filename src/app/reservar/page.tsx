'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ExtraItem { id: string; key: string; name: string; price: number; active: boolean }
interface SpecialEvent { id: string; title: string; description: string; date: string; experience: string; price_override: number | null }

const BASE_GLOW = ['7 horas de estadía con uso libre de instalaciones (10:00 a 17:00)','Estacionamiento gratuito','Desayuno y almuerzo','Masaje descontracturante','Bebida (jugo, agua saborizada, gaseosa)']
const BASE_BLACK = ['7 horas de estadía con uso libre de instalaciones (16:00 a 23:00)','Estacionamiento gratuito','Merienda y cena show','Masaje descontracturante','Bebida (jugo, agua saborizada, gaseosa)']

type Step = 'experience' | 'people' | 'date' | 'extras' | 'ticket' | 'done'

export default function ReservarPage() {
  const [step, setStep] = useState<Step>('experience')
  const [exp, setExp] = useState<'glow_days' | 'black_nights' | ''>('')
  const [mode, setMode] = useState<'solo' | 'acompanado' | 'grupo'>('solo')
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [selectedDate, setSelectedDate] = useState('')
  const [allInclusive, setAllInclusive] = useState(false)
  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [extrasList, setExtrasList] = useState<ExtraItem[]>([])
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([])
  const [dayEvent, setDayEvent] = useState<SpecialEvent | null>(null)
  const [showEventsPopup, setShowEventsPopup] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [coupon, setCoupon] = useState('')
  const [error, setError] = useState('')
  const [reserva, setReserva] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [availability, setAvailability] = useState<Record<string, { glow: number; black: number }>>({})
  const [glowPrice, setGlowPrice] = useState(85000)
  const [blackPrice, setBlackPrice] = useState(120000)
  const [allIncDiscount, setAllIncDiscount] = useState(0)
  const [weekdayDiscount, setWeekdayDiscount] = useState(0)
  const [weekendSurcharge, setWeekendSurcharge] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0') })

  const basePrice = exp === 'glow_days' ? glowPrice : blackPrice
  const eventPrice = dayEvent?.price_override ?? null
  
  // Day-based pricing
  const getDayAdjustment = () => {
    if (!selectedDate) return 0
    const dow = new Date(selectedDate + 'T12:00').getDay()
    if (dow >= 1 && dow <= 4) return -weekdayDiscount // Mon-Thu discount
    if (dow === 5 || dow === 6 || dow === 0) return weekendSurcharge // Fri-Sun surcharge
    return 0
  }
  
  const price = eventPrice ?? (basePrice + getDayAdjustment())
  const personCount = mode === 'solo' ? 1 : mode === 'acompanado' ? 2 : adults
  const discount = mode === 'grupo' && personCount >= 4 ? price : 0
  
  const extrasSum = extrasList.filter(e => selectedExtras.includes(e.key)).reduce((s, e) => s + e.price, 0)
  const allIncDiscountApplied = allInclusive && selectedExtras.length === extrasList.length ? allIncDiscount : 0
  const extrasPerPerson = extrasSum - allIncDiscountApplied
  const extrasTotal = Math.max(0, extrasPerPerson) * personCount
  
  const subtotal = price * personCount
  const total = Math.max(0, subtotal - discount + extrasTotal)
  const includes = exp === 'glow_days' ? BASE_GLOW : BASE_BLACK
  const fmtMoney = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

  useEffect(() => {
    supabase.from('extras').select('*').eq('active', true).order('sort_order').then(({ data }) => { if (data) setExtrasList(data) })
    supabase.from('site_config').select('*').single().then(({ data }) => {
      if (data) {
        setGlowPrice(data.glow_price); setBlackPrice(data.black_price)
        setAllIncDiscount(data.all_inclusive_discount || 0)
        setWeekdayDiscount(data.weekday_discount || 0)
        setWeekendSurcharge(data.weekend_surcharge || 0)
      }
    })
    supabase.from('special_events').select('*').eq('active', true).then(({ data }) => { if (data) setSpecialEvents(data) })
  }, [])

  useEffect(() => { fetch('/api/reservas/availability?month='+currentMonth).then(r=>r.json()).then(d=>setAvailability(d.days||{})).catch(()=>{}) }, [currentMonth])

  useEffect(() => {
    if (selectedDate) { const ev = specialEvents.find(e => e.date === selectedDate && (e.experience === 'both' || e.experience === exp)); setDayEvent(ev || null) }
    else setDayEvent(null)
  }, [selectedDate, specialEvents, exp])

  const toggleAllInclusive = () => {
    if (!allInclusive) { setAllInclusive(true); setSelectedExtras(extrasList.map(e => e.key)) }
    else { setAllInclusive(false); setSelectedExtras([]) }
  }
  const toggleExtra = (key: string) => {
    setSelectedExtras(prev => { const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]; setAllInclusive(next.length === extrasList.length); return next })
  }
  const validatePeople = () => {
    setError('')
    if (mode === 'grupo' && (adults + children) < 3) { setError('La promo grupo es para más de 3 personas, estás intentando reservar para '+(adults+children)+'. Para la promo de a 2 o de a 1 persona seleccioná la opción correcta arriba.'); return false }
    return true
  }
  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { setError('Completá nombre y teléfono'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/reservas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experience: exp, date: selectedDate, adults: personCount, children, mode, all_inclusive: allInclusive,
          extras: selectedExtras.map(k => extrasList.find(e => e.key === k)?.name).filter(Boolean),
          user_name: name, user_phone: phone, user_email: email, coupon_code: coupon || null, notes: dayEvent ? 'Evento: '+dayEvent.title : '' })
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setReserva(data.reserva); setStep('done')
    } catch { setError('Error de conexión') }
    setLoading(false)
  }

  const [year, month] = currentMonth.split('-').map(Number)
  const firstDay = new Date(year, month-1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date().toISOString().slice(0,10)
  const mNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const getDS = (d: number) => year+'-'+String(month).padStart(2,'0')+'-'+String(d).padStart(2,'0')
  const isAvail = (d: number) => { const s=getDS(d); if(s<today)return false; const a=availability[s]; if(!a)return true; return (exp==='glow_days'?a.glow:a.black)<60 }
  const isSpecial = (d: number) => specialEvents.some(e => e.date === getDS(d) && (e.experience === 'both' || e.experience === exp))
  const chgMonth = (dir: number) => { const d=new Date(year,month-1+dir,1); setCurrentMonth(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')) }

  const PriceSummary = () => (
    <div className="bg-black/30 border border-[#1e3838] p-3 mb-4 space-y-1 text-xs">
      <div className="flex justify-between"><span className="text-white/40">Base ({personCount} × {fmtMoney(price)})</span><span className="text-[#f5f0e0]">{fmtMoney(subtotal)}</span></div>
      {discount > 0 && <div className="flex justify-between text-green-400"><span>Descuento grupo (-1 persona)</span><span>-{fmtMoney(discount)}</span></div>}
      {extrasTotal > 0 && <div className="flex justify-between"><span className="text-white/40">Adicionales ({personCount} pers.)</span><span className="text-[#f5f0e0]">{fmtMoney(extrasTotal)}</span></div>}
      {allIncDiscountApplied > 0 && <div className="flex justify-between text-green-400"><span>Descuento All Inclusive</span><span>-{fmtMoney(allIncDiscountApplied * personCount)}/incluido</span></div>}
      <div className="flex justify-between border-t border-dashed border-[#1e3838] pt-1 mt-1">
        <span className="font-display text-sm font-semibold text-[#dcc07a]">TOTAL</span>
        <span className="font-display text-sm font-semibold text-[#dcc07a]">{fmtMoney(total)}</span>
      </div>
    </div>
  )

  // Events popup
  const EventsPopup = () => (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowEventsPopup(false)}>
      <div className="bg-[#132828] border border-[#1e3838] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-lg text-[#f5f0e0]">Próximas Fechas Especiales</h3>
          <button onClick={() => setShowEventsPopup(false)} className="text-[#c5a55a] text-xl">✕</button>
        </div>
        {specialEvents.length === 0 && <p className="text-white/30 text-sm text-center py-4">No hay eventos programados.</p>}
        {specialEvents.filter(e => e.date >= today).sort((a,b) => a.date.localeCompare(b.date)).map(ev => (
          <div key={ev.id} className="border-b border-[#1e3838] py-3 last:border-0">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-pink-300 font-display font-medium text-sm">🎉 {ev.title}</span>
                <p className="text-xs text-white/30 mt-0.5">{new Date(ev.date+'T12:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</p>
              </div>
              <span className="text-[.55rem] uppercase tracking-wider text-white/20">{ev.experience === 'both' ? 'Día y Noche' : ev.experience === 'glow_days' ? 'Glow Days' : 'Black Nights'}</span>
            </div>
            {ev.description && <p className="text-xs text-white/40 mt-1">{ev.description}</p>}
            {ev.price_override && <p className="text-xs text-pink-300/60 mt-1">Precio especial: {fmtMoney(ev.price_override)}/persona</p>}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0c1a1a] flex items-center justify-center p-4">
      {showEventsPopup && <EventsPopup />}
      <div className="w-full max-w-lg bg-[#132828] border border-[#1e3838] p-6 md:p-8">
        <div className="text-center mb-6">
          <a href="/" className="inline-block mb-4"><span className="font-display text-2xl font-semibold text-[#dcc07a]">Rieck</span><span className="block text-[.5rem] tracking-[.3em] uppercase text-white/90">Glow Days & Nights</span></a>
          <div className="flex justify-center gap-1 mb-4">
            {['experience','date','people','extras','ticket'].map((s,i) => (<div key={s} className={'h-1 rounded-full transition-all '+(['experience','date','people','extras','ticket'].indexOf(step)>=i?'bg-[#c5a55a] w-8':'bg-[#1e3838] w-4')} />))}
          </div>
        </div>

        {step==='experience' && (<div>
          <h2 className="font-display text-xl font-medium text-[#f5f0e0] mb-1">¿Qué experiencia querés reservar?</h2>
          <p className="text-sm text-white/50 mb-6">Elegí entre nuestras dos experiencias.</p>
          <div className="space-y-3">
            {[{k:'glow_days' as const,n:'Glow Days',d:'Naturaleza, pileta y relax · 10:00 a 17:00',p:glowPrice},{k:'black_nights' as const,n:'Black Nights',d:'Coctelería, cena show y música · 16:00 a 23:00',p:blackPrice}].map(o=>(
              <button key={o.k} onClick={()=>{setExp(o.k);setStep('date')}} className="w-full text-left p-4 border border-[#1e3838] hover:border-[#c5a55a] transition-all group">
                <div className="flex justify-between items-center"><div><div className="font-display text-lg font-medium text-[#f5f0e0] group-hover:text-[#dcc07a]">{o.n}</div><div className="text-xs text-[#c5a55a] italic">{o.d}</div></div><div className="font-display text-xl font-semibold text-[#dcc07a]">{fmtMoney(o.p)}</div></div>
              </button>))}
          </div>
          <a href="/" className="block text-center text-xs text-white/30 mt-6 hover:text-[#dcc07a]">← Volver al sitio</a>
        </div>)}

        {step==='people' && (<div>
          <h2 className="font-display text-xl font-medium text-[#f5f0e0] mb-1">¿Cuántos van a venir?</h2>
          <p className="text-sm text-white/50 mb-6">Seleccioná la modalidad.</p>
          <div className="space-y-2 mb-4">
            {[{v:'solo' as const,l:'Solo/a',d:'1 persona'},{v:'acompanado' as const,l:'Acompañado/a',d:'2 personas'},{v:'grupo' as const,l:'En grupo',d:'3+ personas'}].map(o=>(
              <label key={o.v} className={'flex items-center gap-3 p-3 border cursor-pointer transition-all '+(mode===o.v?'border-[#c5a55a] bg-[#c5a55a]/5':'border-[#1e3838]')}
                onClick={()=>{setMode(o.v);if(o.v==='solo')setAdults(1);if(o.v==='acompanado')setAdults(2);if(o.v==='grupo'&&adults<3)setAdults(3);setError('')}}>
                <input type="radio" name="mode" checked={mode===o.v} readOnly className="accent-[#c5a55a]" />
                <span className="font-display text-sm font-medium text-[#f5f0e0]">{o.l}</span><span className="text-xs text-white/30 ml-auto">{o.d}</span>
              </label>))}
          </div>
          {mode==='grupo' && (<div className="grid grid-cols-2 gap-3 mb-4">
            <div><label className="block text-[.6rem] tracking-widest uppercase text-white/30 mb-1">Adultos</label><input type="number" min={1} value={adults} onChange={e=>{setAdults(parseInt(e.target.value)||1);setError('')}} className="w-full p-2 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-[#c5a55a]" /></div>
            <div><label className="block text-[.6rem] tracking-widest uppercase text-white/30 mb-1">Niños (5-11)</label><input type="number" min={0} value={children} onChange={e=>setChildren(parseInt(e.target.value)||0)} className="w-full p-2 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-[#c5a55a]" /></div>
          </div>)}
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 mb-4">{error}</div>}
          <div className="flex gap-2">
            <button onClick={()=>setStep('people')} className="flex-1 p-3 border border-[#1e3838] text-white/50 text-sm">← Volver</button>
            <button onClick={()=>{if(validatePeople())setStep('extras')}} className="flex-1 p-3 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold">Siguiente →</button>
          </div>
        </div>)}

        {step==='date' && (<div>
          <h2 className="font-display text-xl font-medium text-[#f5f0e0] mb-1">Elegí el día</h2>
          <p className="text-sm text-white/50 mb-1">Fechas disponibles para {exp==='glow_days'?'Glow Days':'Black Nights'}.</p>
          <p className="text-[.65rem] text-pink-400/70 mb-4 cursor-pointer hover:text-pink-300" onClick={() => setShowEventsPopup(true)}>
            * Las fechas en rosa corresponden a promos y eventos especiales. <span className="underline">Consultá próximas fechas especiales →</span>
          </p>
          <div className="border border-[#1e3838] p-4 mb-4">
            <div className="flex items-center justify-between mb-3"><button onClick={()=>chgMonth(-1)} className="text-[#c5a55a] text-lg px-2">‹</button><span className="font-display text-sm text-[#f5f0e0]">{mNames[month-1]} {year}</span><button onClick={()=>chgMonth(1)} className="text-[#c5a55a] text-lg px-2">›</button></div>
            <div className="grid grid-cols-7 gap-1 text-center text-[.6rem] text-white/30 mb-2">{['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map(d=><div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {Array(firstDay).fill(null).map((_,i)=><div key={'e'+i}/>)}
              {Array(daysInMonth).fill(null).map((_,i)=>{const day=i+1,ds=getDS(day),av=isAvail(day),sel=ds===selectedDate,sp=isSpecial(day);return(
                <button key={day} disabled={!av} onClick={()=>setSelectedDate(ds)} className={'p-2 text-xs rounded transition-all '+(sel?'bg-[#c5a55a] text-[#0c1a1a] font-bold':sp&&av?'text-pink-400 bg-pink-400/10 hover:bg-pink-400/20 font-medium':av?'text-[#f5f0e0] hover:bg-[#c5a55a]/10':'text-white/15 cursor-not-allowed')}>{day}</button>
              )})}
            </div>
          </div>
          {selectedDate && <p className="text-xs text-[#c5a55a] mb-2 text-center">📅 {new Date(selectedDate+'T12:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</p>}
          {dayEvent && (<div className="bg-pink-400/10 border border-pink-400/20 p-3 mb-4 text-center"><div className="text-sm font-display font-medium text-pink-300">🎉 {dayEvent.title}</div>{dayEvent.description&&<p className="text-xs text-pink-300/60 mt-1">{dayEvent.description}</p>}{dayEvent.price_override&&<p className="text-xs text-pink-300 mt-1">Precio especial: {fmtMoney(dayEvent.price_override)}/persona</p>}</div>)}
          {getDayAdjustment() !== 0 && !dayEvent && <p className="text-xs text-center mb-4 text-green-400">{getDayAdjustment() < 0 ? `Descuento día de semana: -${fmtMoney(Math.abs(getDayAdjustment()))}` : `Recargo fin de semana: +${fmtMoney(getDayAdjustment())}`}</p>}
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 mb-4">{error}</div>}
          <div className="flex gap-2">
            <button onClick={()=>{setStep('experience');setExp('')}} className="flex-1 p-3 border border-[#1e3838] text-white/50 text-sm">← Volver</button>
            <button onClick={()=>{if(!selectedDate){setError('Elegí una fecha');return};setError('');setStep('people')}} className="flex-1 p-3 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold">Siguiente →</button>
          </div>
        </div>)}

        {step==='extras' && (<div>
          {dayEvent && (<div className="bg-pink-400/10 border border-pink-400/20 p-3 mb-4 text-center"><div className="text-xs font-display font-medium text-pink-300">🎉 Especial: {dayEvent.title}</div></div>)}
          <h2 className="font-display text-xl font-medium text-[#f5f0e0] mb-1">Adicionales</h2>
          <p className="text-sm text-white/50 mb-4">Por persona obtenés:</p>
          <label className="flex items-center gap-3 p-3 border border-[#c5a55a]/20 bg-[#c5a55a]/5 cursor-pointer mb-1" onClick={toggleAllInclusive}>
            <input type="checkbox" checked={allInclusive} readOnly className="accent-[#c5a55a] w-4 h-4" />
            <span className="font-display text-sm font-medium text-[#dcc07a]">🌟 All Inclusive (todo incluido para cada persona)</span>
          </label>
          {allInclusive && allIncDiscount > 0 && <p className="text-xs text-green-400 mb-3 ml-1">Descuento All Inclusive: -{fmtMoney(allIncDiscount)} por persona</p>}
          <div className="space-y-1 mb-4">
            {extrasList.map(ext=>(<label key={ext.key} className={'flex items-center gap-3 p-2.5 cursor-pointer transition-all border '+(selectedExtras.includes(ext.key)?'border-[#c5a55a]/20 bg-[#c5a55a]/5':'border-transparent hover:bg-white/[.02]')} onClick={()=>toggleExtra(ext.key)}>
              <input type="checkbox" checked={selectedExtras.includes(ext.key)} readOnly className="accent-[#c5a55a] w-3.5 h-3.5" />
              <span className="text-xs text-white/60 flex-1">{ext.name}</span>
              <span className="text-xs text-[#c5a55a] font-medium">{fmtMoney(ext.price)}</span>
            </label>))}
          </div>
          <PriceSummary />
          <div className="flex gap-2">
            <button onClick={()=>setStep('people')} className="flex-1 p-3 border border-[#1e3838] text-white/50 text-sm">← Volver</button>
            <button onClick={()=>setStep('ticket')} className="flex-1 p-3 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold">Ver Ticket →</button>
          </div>
        </div>)}

        {step==='ticket' && (<div>
          <h2 className="font-display text-xl font-medium text-[#f5f0e0] mb-1">Tu Reserva</h2>
          <p className="text-sm text-white/50 mb-4">Completá tus datos y confirmá.</p>
          <div className="space-y-3 mb-4">
            <input placeholder="Nombre completo" value={name} onChange={e=>setName(e.target.value)} className="w-full p-2.5 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-[#c5a55a] placeholder:text-white/20" />
            <input placeholder="WhatsApp (+54 9 11...)" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-2.5 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-[#c5a55a] placeholder:text-white/20" />
            <input placeholder="Email (opcional)" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2.5 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-[#c5a55a] placeholder:text-white/20" />
            <input placeholder="Código de cupón (opcional)" value={coupon} onChange={e=>setCoupon(e.target.value)} className="w-full p-2.5 bg-white/5 border border-[#1e3838] text-white text-sm outline-none focus:border-[#c5a55a] placeholder:text-white/20" />
          </div>
          <div className="bg-black/20 border border-[#1e3838] p-4 text-xs space-y-1 mb-4">
            <div className="flex justify-between"><strong className="text-[#f5f0e0]">{exp==='glow_days'?'Glow Days':'Black Nights'}</strong><span className="text-white/40">{personCount} persona{personCount>1?'s':''}</span></div>
            {children>0&&<div className="text-white/30">+ {children} niño{children>1?'s':''} (instalaciones gratis)</div>}
            {dayEvent&&<div className="text-pink-300 text-[.65rem]">🎉 {dayEvent.title}</div>}
            <div className="border-t border-dashed border-[#1e3838] my-2" />
            <div className="text-[.6rem] uppercase tracking-wider text-white/20 mb-1">Incluye:</div>
            {includes.map((inc,i)=><div key={i} className="text-white/40">✦ {inc}</div>)}
            {selectedExtras.length>0&&(<><div className="border-t border-dashed border-[#1e3838] my-2" /><div className="text-[.6rem] uppercase tracking-wider text-white/20 mb-1">{allInclusive?'🌟 All Inclusive:':'Adicionales:'}</div>
            {selectedExtras.map(k=>{const e=extrasList.find(x=>x.key===k);return e?<div key={k} className="flex justify-between"><span className="text-white/40">✦ {e.name}</span><span className="text-white/30">{fmtMoney(e.price)}</span></div>:null})}</>)}
            <div className="border-t border-dashed border-[#1e3838] my-2" />
            <div className="flex justify-between"><span>Precio por persona</span><strong className="text-[#f5f0e0]">{fmtMoney(price)}</strong></div>
            <div className="flex justify-between"><span>Cantidad</span><strong className="text-[#f5f0e0]">{personCount}</strong></div>
            {extrasTotal>0&&<div className="flex justify-between"><span>Adicionales</span><strong className="text-[#f5f0e0]">{fmtMoney(extrasTotal)}</strong></div>}
            {discount>0&&<div className="flex justify-between text-green-400"><span>Descuento grupo</span><span>-{fmtMoney(discount)}</span></div>}
            {allIncDiscountApplied>0&&<div className="flex justify-between text-green-400"><span>Descuento All Inclusive</span><span>-{fmtMoney(allIncDiscountApplied*personCount)}</span></div>}
            <div className="border-t border-dashed border-[#1e3838] my-2" />
            <div className="flex justify-between"><span className="font-display text-lg font-semibold text-[#dcc07a]">TOTAL</span><span className="font-display text-lg font-semibold text-[#dcc07a]">{fmtMoney(total)}</span></div>
            <div className="text-[.65rem] text-white/20 mt-2">📅 {selectedDate&&new Date(selectedDate+'T12:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
            <div className="text-[.65rem] text-white/20">💳 Transferencia · Efectivo · Tarjeta hasta 2 cuotas sin interés</div>
          </div>
          {error&&<div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 mb-4">{error}</div>}
          <div className="flex gap-2">
            <button onClick={()=>setStep('extras')} className="flex-1 p-3 border border-[#1e3838] text-white/50 text-sm">← Volver</button>
            <button onClick={handleSubmit} disabled={loading} className="flex-1 p-3 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold disabled:opacity-50">{loading?'Procesando...':'Confirmar Reserva'}</button>
          </div>
        </div>)}

        {step==='done'&&reserva&&(<div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="font-display text-2xl font-medium text-[#f5f0e0] mb-2">¡Reserva Confirmada!</h2>
          <div className="bg-[#c5a55a]/10 border border-[#c5a55a]/20 p-4 mb-4"><div className="text-[.6rem] tracking-widest uppercase text-white/30 mb-1">Código de reserva</div><div className="font-display text-3xl font-bold text-[#dcc07a] tracking-wider">{reserva.code}</div></div>
          <div className="text-xs text-white/40 space-y-1 mb-4">
            <p>{reserva.experience==='glow_days'?'Glow Days':'Black Nights'} · {new Date(reserva.date+'T12:00').toLocaleDateString('es-AR',{day:'numeric',month:'long'})}</p>
            <p>{reserva.adults} persona{reserva.adults>1?'s':''} · Total: {fmtMoney(reserva.total)}</p>
            <p className="text-[#c5a55a]">Estado: Pendiente de pago</p>
          </div>
          <div className="space-y-2">
            <a href={'https://wa.me/5491163065144?text='+encodeURIComponent('🎫 RESERVA RIECK: '+reserva.code+'\n'+(reserva.experience==='glow_days'?'Glow Days':'Black Nights')+'\n'+reserva.adults+' personas · Total: '+fmtMoney(reserva.total)+'\n\n¡Quiero confirmar el pago!')} target="_blank" className="block w-full p-3 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold text-center">Confirmar Pago por WhatsApp</a>
            <button onClick={()=>{navigator.clipboard.writeText(window.location.origin+'/panel?code='+reserva.code);alert('Link copiado!')}} className="block w-full p-3 border border-[#1e3838] text-white/50 text-sm text-center hover:border-[#c5a55a] cursor-pointer">📋 Copiar link de reserva</button>
            <a href="/" className="block text-xs text-white/30 hover:text-[#dcc07a] mt-2">Volver al sitio</a>
          </div>
        </div>)}
      </div>
    </div>
  )
}
