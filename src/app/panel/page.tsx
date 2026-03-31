'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ===== TYPES =====
interface Package { id: string; slug: string; name: string; description: string; cost_price: number; public_price: number; includes: string[]; default_open_time: string; default_close_time: string; is_active: boolean; sort_order: number }
interface DiscountPack { id: string; name: string; description: string; package_id: string | null; people_count: number; total_price: number; is_active: boolean }
interface Extra { id: string; key: string; name: string; price: number; active: boolean; extra_type: string; transport_direction: string | null }
interface Schedule { id: string; package_id: string; day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }
interface DateOverride { id: string; package_id: string; date: string; open_time: string | null; close_time: string | null; is_closed: boolean }

const fm = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const sc = (s: string) => s === 'paid' ? 'text-green-400 bg-green-400/10' : s === 'pending' ? 'text-yellow-400 bg-yellow-400/10' : s === 'cancelled' ? 'text-red-400 bg-red-400/10' : 'text-blue-400 bg-blue-400/10'
const sl = (s: string) => ({ pending: 'Pendiente', paid: 'Pagado', cancelled: 'Cancelado', completed: 'Completado', refunded: 'Reembolsado' }[s] || s)

// ===== SHARED SELECT COMPONENT =====
function Select({ value, onChange, children, className = '' }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; className?: string }) {
  return <select value={value} onChange={onChange} className={`p-2 bg-[#132828] border border-[#1e3838] text-[#f5f0e0] text-sm outline-none focus:border-[#c5a55a] ${className}`}>{children}</select>
}

// ===== SHARED INPUT COMPONENT =====
function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`p-2 bg-[#0f2020] border border-[#1e3838] text-[#f5f0e0] text-sm outline-none focus:border-[#c5a55a] placeholder:text-white/20 ${className}`} />
}

export default function PanelPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reservas, setReservas] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [coupons, setCoupons] = useState<any[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [tab, setTab] = useState('reservas')
  const [showExtrasPopup, setShowExtrasPopup] = useState(false)
  const [showNewReserva, setShowNewReserva] = useState(false)

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    const { data: prof } = await supabase.from('users').select('*').eq('auth_id', user.id).single()
    if (!prof) { setLoading(false); return }
    setProfile(prof); await loadData(prof); setLoading(false)
  }

  const loadData = async (prof: any) => {
    let q = supabase.from('reservations').select('*').order('created_at', { ascending: false })
    if (prof.role === 'afiliado') {
      const { data: a } = await supabase.from('affiliates').select('*').eq('user_id', prof.id).single()
      if (a) q = q.eq('affiliate_id', a.id)
    } else if (prof.role === 'cliente') q = q.eq('user_id', prof.id)
    const { data } = await q; setReservas(data || [])
    if (prof.role === 'admin') {
      const { data: c } = await supabase.from('site_config').select('*').single(); if (c) setConfig(c)
      const { data: cp } = await supabase.from('coupons').select('*').order('created_at', { ascending: false }); setCoupons(cp || [])
      const { data: pkg } = await supabase.from('packages').select('*').order('sort_order'); if (pkg) setPackages(pkg)
    }
  }

  const uc = async (f: string, v: any) => {
    await supabase.from('site_config').update({ [f]: v, updated_at: new Date().toISOString() }).eq('id', 1)
    const { data } = await supabase.from('site_config').select('*').single(); if (data) setConfig(data)
  }

  const urs = async (id: string, s: string) => {
    await supabase.from('reservations').update({ status: s, updated_at: new Date().toISOString() }).eq('id', id)
    if (profile) await loadData(profile)
  }

  const reloadPkgs = async () => {
    const { data } = await supabase.from('packages').select('*').order('sort_order')
    if (data) setPackages(data)
  }

  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  if (loading) return <div className="min-h-screen bg-[#0c1a1a] flex items-center justify-center"><div className="text-[#c5a55a] font-display text-xl animate-pulse">Cargando...</div></div>
  if (!profile) return null

  const isAdmin = profile.role === 'admin'
  const isAfiliado = profile.role === 'afiliado'
  const rev = reservas.filter(r => r.status === 'paid').reduce((s, r) => s + r.total, 0)
  const pend = reservas.filter(r => r.status === 'pending').length

  const tabs = isAdmin
    ? [{ k: 'reservas', l: 'Reservas' }, { k: 'config', l: 'Configuración' }, { k: 'calendario', l: 'Calendario' }, { k: 'coupons', l: 'Cupones' }, { k: 'levels', l: 'Comisiones' }, { k: 'users', l: 'Usuarios' }, { k: 'news', l: 'Noticias' }]
    : isAfiliado ? [{ k: 'reservas', l: 'Referidos' }, { k: 'storefront', l: 'Mi Tienda' }, { k: 'stats', l: 'Comisiones' }]
      : [{ k: 'reservas', l: 'Mis Reservas' }]

  return (
    <div className="min-h-screen bg-[#0c1a1a]">
      <nav className="border-b border-[#1e3838] bg-[#132828] px-4 py-3 flex items-center justify-between">
        <a href="/" className="flex flex-col items-center"><span className="font-display text-lg font-semibold text-[#dcc07a]">Rieck</span><span className="text-[.4rem] tracking-[.25em] uppercase text-white/80">Glow Days & Nights</span></a>
        <div className="flex items-center gap-4"><span className="text-xs text-white/40">{profile.name || profile.email}</span><span className="text-[.55rem] uppercase tracking-wider px-2 py-0.5 bg-[#c5a55a]/10 text-[#c5a55a]">{profile.role}</span><button onClick={logout} className="text-xs text-white/30 hover:text-red-400">Salir</button></div>
      </nav>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-6`}>
          <div className="bg-[#132828] border border-[#1e3838] p-4"><div className="text-[.55rem] uppercase tracking-wider text-white/30 mb-1">{isAdmin ? 'Reservas' : 'Mis Reservas'}</div><div className="font-display text-2xl text-[#f5f0e0]">{reservas.length}</div></div>
          <div className="bg-[#132828] border border-[#1e3838] p-4"><div className="text-[.55rem] uppercase tracking-wider text-white/30 mb-1">Pendientes</div><div className="font-display text-2xl text-yellow-400">{pend}</div></div>
          {(isAdmin || isAfiliado) && <div className="bg-[#132828] border border-[#1e3838] p-4"><div className="text-[.55rem] uppercase tracking-wider text-white/30 mb-1">Ingresos</div><div className="font-display text-2xl text-green-400">{fm(rev)}</div></div>}
        </div>
        <div className="flex flex-wrap border-b border-[#1e3838] mb-6 gap-1">
          {tabs.map(t => <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 pb-2 text-[.6rem] tracking-widest uppercase ${tab === t.k ? 'text-[#c5a55a] border-b-2 border-[#c5a55a]' : 'text-white/30'}`}>{t.l}</button>)}
        </div>

        {/* ========== RESERVAS ========== */}
        {tab === 'reservas' && <div className="space-y-3">
          {isAdmin && <button onClick={() => setShowNewReserva(true)} className="w-full p-3 border border-[#c5a55a]/30 text-[#c5a55a] text-sm hover:bg-[#c5a55a]/5 transition-all mb-2">+ Crear Reserva Manual</button>}
          {reservas.length === 0 && <p className="text-center text-white/30 text-sm py-8">No hay reservas.</p>}
          {reservas.map(r => <div key={r.id} className="bg-[#132828] border border-[#1e3838] p-4">
            <div className="flex items-start justify-between mb-2"><div><span className="font-mono text-sm text-[#dcc07a] font-semibold tracking-wider">{r.code}</span><span className={`ml-2 text-[.6rem] uppercase tracking-wider px-2 py-0.5 ${sc(r.status)}`}>{sl(r.status)}</span></div><span className="font-display text-lg font-semibold text-[#f5f0e0]">{fm(r.total)}</span></div>
            <div className="text-xs text-white/40">
              <p>{r.experience} · {new Date(r.date + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} · {r.adults} pers.</p>
              <p>{r.user_name} · {r.user_phone}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {r.notes && r.notes.includes('[MANUAL]') && <span className="text-[.55rem] px-1 py-0.5 bg-blue-400/10 text-blue-400">Manual</span>}
                {r.payment_type === 'deposit' && <span className="text-[.55rem] px-1 py-0.5 bg-yellow-400/10 text-yellow-400">Seña</span>}
                {r.is_gift && <span className="text-[.55rem] px-1 py-0.5 bg-pink-400/10 text-pink-400">🎁 → {r.gifted_to_name}</span>}
                {r.affiliate_code_used && <span className="text-[.55rem] px-1 py-0.5 bg-[#c5a55a]/10 text-[#c5a55a]">Ref: {r.affiliate_code_used}</span>}
                {r.coupon_code && <span className="text-[.55rem] px-1 py-0.5 bg-white/5 text-white/30">Cupón: {r.coupon_code}</span>}
              </div>
              {r.payment_type === 'deposit' && r.amount_remaining > 0 && <p className="text-[.55rem] text-yellow-400 mt-1">Resta: {fm(r.amount_remaining)} a cobrar en el lugar</p>}
            </div>
            {isAdmin && r.status === 'pending' && <div className="flex gap-2 mt-3"><button onClick={() => urs(r.id, 'paid')} className="text-[.6rem] uppercase px-3 py-1.5 bg-green-400/10 text-green-400 border border-green-400/20">Pagado</button><button onClick={() => urs(r.id, 'cancelled')} className="text-[.6rem] uppercase px-3 py-1.5 bg-red-400/10 text-red-400 border border-red-400/20">Cancelar</button></div>}
            {isAdmin && r.status === 'paid' && <button onClick={() => urs(r.id, 'completed')} className="mt-3 text-[.6rem] uppercase px-3 py-1.5 bg-blue-400/10 text-blue-400 border border-blue-400/20">Completado</button>}
          </div>)}
        </div>}

        {/* ========== NUEVA RESERVA MANUAL (modal) ========== */}
        {showNewReserva && <ManualReservationModal packages={packages} onClose={() => setShowNewReserva(false)} onCreated={() => { setShowNewReserva(false); loadData(profile) }} />}

        {/* ========== CONFIGURACIÓN ========== */}
        {tab === 'config' && isAdmin && config && <div className="space-y-6">
          <PackagesPanel packages={packages} reload={reloadPkgs} />
          <DiscountPacksPanel packages={packages} />
          <div className="bg-[#132828] border border-[#1e3838] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg text-[#f5f0e0]">Extras / Adicionales</h3>
              <button onClick={() => setShowExtrasPopup(true)} className="px-4 py-1.5 border border-[#c5a55a]/20 text-[#c5a55a] text-xs hover:bg-[#c5a55a]/5">Editar Extras</button>
            </div>
            <p className="text-xs text-white/30">Incluye servicio de transporte con opciones de ida, vuelta o ambas.</p>
          </div>
          <div className="bg-[#132828] border border-[#1e3838] p-6 space-y-4">
            <h3 className="font-display text-lg text-[#f5f0e0]">Configuración General</h3>
            {[{ l: 'Capacidad máxima / Día', f: 'max_capacity', v: config.max_capacity }, { l: 'Descuento All Inclusive', f: 'all_inclusive_discount', v: config.all_inclusive_discount || 0 }].map(i => <div key={i.f} className="flex items-center justify-between"><label className="text-xs text-white/50">{i.l}</label><Input type="number" defaultValue={i.v} onBlur={e => uc(i.f, parseFloat(e.target.value))} className="w-36 text-right" /></div>)}
            <div className="flex items-center justify-between">
              <div><label className="text-xs text-white/50">Anticipación mínima para reservar</label><p className="text-[.55rem] text-white/20">Horas de anticipación requeridas</p></div>
              <div className="flex items-center gap-2"><Input type="number" defaultValue={config.min_anticipation_hours || 48} onBlur={e => uc('min_anticipation_hours', parseInt(e.target.value) || 48)} className="w-20 text-right" /><span className="text-xs text-white/30">hs</span></div>
            </div>
          </div>

          {/* PAGOS & MERCADO PAGO */}
          <div className="bg-[#132828] border border-[#1e3838] p-6 space-y-4">
            <h3 className="font-display text-lg text-[#f5f0e0]">Pagos & Mercado Pago</h3>
            <div className="flex items-center justify-between">
              <div><label className="text-xs text-white/50">Permitir seña parcial</label><p className="text-[.55rem] text-white/20">El cliente puede pagar un % y el resto al llegar</p></div>
              <button onClick={() => uc('deposit_enabled', !config.deposit_enabled)} className={`px-4 py-1.5 text-xs font-semibold ${config.deposit_enabled ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>{config.deposit_enabled ? 'Activo' : 'Off'}</button>
            </div>
            {config.deposit_enabled && <div className="flex items-center justify-between">
              <div><label className="text-xs text-white/50">Porcentaje de seña</label><p className="text-[.55rem] text-white/20">100 = pago total obligatorio</p></div>
              <div className="flex items-center gap-2"><Input type="number" defaultValue={config.deposit_percent || 100} min={10} max={100} onBlur={e => uc('deposit_percent', Math.max(10, Math.min(100, parseInt(e.target.value) || 100)))} className="w-20 text-right" /><span className="text-xs text-white/30">%</span></div>
            </div>}
            <div className="flex items-center justify-between">
              <div><label className="text-xs text-white/50">Máx. modificaciones de fecha</label><p className="text-[.55rem] text-white/20">Cuántas veces puede cambiar la fecha</p></div>
              <Input type="number" defaultValue={config.max_modifications || 2} onBlur={e => uc('max_modifications', parseInt(e.target.value) || 2)} className="w-20 text-right" />
            </div>
            <div className="border-t border-[#1e3838] pt-4">
              <div className="text-[.6rem] uppercase tracking-wider text-[#c5a55a] mb-3">Credenciales Mercado Pago</div>
              <p className="text-[.55rem] text-white/20 mb-3">Obtené tus credenciales en mercadopago.com.ar → Tu negocio → Configuración → Credenciales</p>
              <div className="space-y-2">
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Public Key</label><Input defaultValue={config.mp_public_key || ''} onBlur={e => uc('mp_public_key', e.target.value)} placeholder="APP_USR-..." className="w-full text-xs font-mono" /></div>
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Access Token</label><Input type="password" defaultValue={config.mp_access_token || ''} onBlur={e => uc('mp_access_token', e.target.value)} placeholder="APP_USR-..." className="w-full text-xs font-mono" /></div>
              </div>
              {config.mp_access_token ? <p className="text-[.55rem] text-green-400 mt-2">✓ Mercado Pago configurado — los pagos se procesan automáticamente</p> : <p className="text-[.55rem] text-yellow-400 mt-2">⚠ Sin configurar — las reservas se crean como pendientes (pago por WhatsApp)</p>}
            </div>
          </div>
          <div className="bg-[#132828] border border-[#1e3838] p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-display text-lg text-[#f5f0e0]">Promoción Web</h3><button onClick={() => uc('promo_enabled', !config.promo_enabled)} className={`px-4 py-1.5 text-xs font-semibold ${config.promo_enabled ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>{config.promo_enabled ? 'Activa' : 'Off'}</button></div>
            {config.promo_enabled && <div className="space-y-2">
              <Input defaultValue={config.promo_title || ''} onBlur={e => uc('promo_title', e.target.value)} placeholder="Título" className="w-full" />
              <Input defaultValue={config.promo_subtitle || ''} onBlur={e => uc('promo_subtitle', e.target.value)} placeholder="Subtítulo" className="w-full" />
              <textarea defaultValue={config.promo_description || ''} onBlur={e => uc('promo_description', e.target.value)} rows={2} placeholder="Descripción" className="w-full p-2 bg-[#0f2020] border border-[#1e3838] text-[#f5f0e0] text-sm outline-none focus:border-[#c5a55a] resize-none placeholder:text-white/20" />
            </div>}
          </div>
        </div>}

        {showExtrasPopup && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowExtrasPopup(false)}><div className="bg-[#132828] border border-[#1e3838] p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><h3 className="font-display text-lg text-[#f5f0e0]">Extras / Adicionales</h3><button onClick={() => setShowExtrasPopup(false)} className="text-[#c5a55a] text-xl">✕</button></div><ExtrasEditor /></div></div>}

        {tab === 'calendario' && isAdmin && config && <CalendarAdmin config={config} uc={uc} packages={packages} />}
        {tab === 'coupons' && isAdmin && <CouponsPanel coupons={coupons} reload={async () => { const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false }); setCoupons(data || []) }} />}
        {tab === 'levels' && isAdmin && <LevelsPanel />}
        {tab === 'users' && isAdmin && <UsersPanel />}
        {tab === 'news' && isAdmin && <NewsPanel uid={profile.id} />}
        {tab === 'storefront' && isAfiliado && <StorefrontPanel userId={profile.id} packages={packages} />}
        {tab === 'stats' && isAfiliado && <div className="bg-[#132828] border border-[#1e3838] p-6"><h3 className="font-display text-lg text-[#f5f0e0] mb-4">Mis Comisiones</h3><p className="text-xs text-white/30">Total referidos: {reservas.length} · Ingresos generados: {fm(rev)}</p></div>}
      </div>
    </div>
  )
}

// ========== PACKAGES PANEL ==========
function PackagesPanel({ packages, reload }: { packages: Package[]; reload: () => Promise<void> }) {
  const [showNew, setShowNew] = useState(false)
  const [nn, setNn] = useState(''); const [nd, setNd] = useState('')
  const [nCost, setNCost] = useState(''); const [nPrice, setNPrice] = useState('')
  const [nOpen, setNOpen] = useState('10:00'); const [nClose, setNClose] = useState('17:00')
  const [editId, setEditId] = useState<string | null>(null)

  const createPkg = async () => {
    if (!nn.trim()) return
    const slug = nn.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    await supabase.from('packages').insert({ slug, name: nn.trim(), description: nd, cost_price: parseFloat(nCost) || 0, public_price: parseFloat(nPrice) || 0, default_open_time: nOpen, default_close_time: nClose, includes: [], sort_order: packages.length + 1 })
    setNn(''); setNd(''); setNCost(''); setNPrice(''); setShowNew(false); reload()
  }

  const updateField = async (id: string, field: string, value: any) => {
    await supabase.from('packages').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id); reload()
  }

  const deletePkg = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Las reservas existentes no se borran.`)) return
    await supabase.from('packages').delete().eq('id', id); reload()
  }

  return (
    <div className="bg-[#132828] border border-[#1e3838] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="font-display text-lg text-[#f5f0e0]">Paquetes / Experiencias</h3><p className="text-[.55rem] text-white/20 mt-0.5">Cada paquete es una experiencia que los clientes pueden reservar</p></div>
        <button onClick={() => setShowNew(!showNew)} className="px-4 py-1.5 border border-[#c5a55a]/20 text-[#c5a55a] text-xs hover:bg-[#c5a55a]/5">{showNew ? 'Cancelar' : '+ Nuevo Paquete'}</button>
      </div>
      {showNew && <div className="bg-[#0c1a1a] border border-[#1e3838] p-4 space-y-3">
        <div className="text-[.6rem] uppercase tracking-wider text-[#c5a55a] mb-1">Nuevo Paquete</div>
        <Input value={nn} onChange={e => setNn(e.target.value)} placeholder="Nombre (ej: Sunset Experience)" className="w-full" />
        <Input value={nd} onChange={e => setNd(e.target.value)} placeholder="Descripción corta" className="w-full" />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Precio costo <span className="tooltip ml-1 cursor-help text-[#c5a55a]" data-tip="El precio mínimo al que un reseller puede vender">ⓘ</span></label><Input type="number" value={nCost} onChange={e => setNCost(e.target.value)} placeholder="$0" className="w-full" /></div>
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Precio público</label><Input type="number" value={nPrice} onChange={e => setNPrice(e.target.value)} placeholder="$0" className="w-full" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Apertura</label><Input type="time" value={nOpen} onChange={e => setNOpen(e.target.value)} className="w-full" /></div>
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Cierre</label><Input type="time" value={nClose} onChange={e => setNClose(e.target.value)} className="w-full" /></div>
        </div>
        <button onClick={createPkg} className="w-full p-2 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold">Crear Paquete</button>
      </div>}
      <div className="space-y-3">
        {packages.map(pkg => (
          <div key={pkg.id} className="border border-[#1e3838] p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="font-display text-sm font-medium text-[#dcc07a]">{pkg.name}</span><span className={`text-[.5rem] px-1.5 py-0.5 ${pkg.is_active ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{pkg.is_active ? 'Activo' : 'Inactivo'}</span></div>
                <p className="text-[.6rem] text-white/30 mt-0.5">{pkg.description} · {pkg.default_open_time} a {pkg.default_close_time}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditId(editId === pkg.id ? null : pkg.id)} className="text-[.55rem] px-2 py-1 text-[#c5a55a] bg-[#c5a55a]/10">{editId === pkg.id ? 'Cerrar' : '✏ Editar'}</button>
                <button onClick={() => updateField(pkg.id, 'is_active', !pkg.is_active)} className={`text-[.55rem] px-2 py-1 ${pkg.is_active ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{pkg.is_active ? 'On' : 'Off'}</button>
                <button onClick={() => deletePkg(pkg.id, pkg.name)} className="text-[.55rem] px-2 py-1 text-red-400 bg-red-400/10">✕</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between bg-[#0c1a1a] p-2"><span className="text-[.55rem] uppercase text-white/30">Costo</span><span className="text-xs text-white/50">{fm(pkg.cost_price)}</span></div>
              <div className="flex items-center justify-between bg-[#0c1a1a] p-2"><span className="text-[.55rem] uppercase text-white/30">Público</span><span className="text-xs text-[#dcc07a] font-semibold">{fm(pkg.public_price)}</span></div>
            </div>
            {editId === pkg.id && <div className="border-t border-[#1e3838] pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Nombre</label><Input defaultValue={pkg.name} onBlur={e => updateField(pkg.id, 'name', e.target.value)} className="w-full" /></div>
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Descripción</label><Input defaultValue={pkg.description} onBlur={e => updateField(pkg.id, 'description', e.target.value)} className="w-full" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Precio costo <span className="tooltip ml-1 cursor-help text-[#c5a55a]" data-tip="El precio mínimo al que un reseller puede vender">ⓘ</span></label><Input type="number" defaultValue={pkg.cost_price} onBlur={e => updateField(pkg.id, 'cost_price', parseFloat(e.target.value) || 0)} className="w-full" /></div>
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Precio público</label><Input type="number" defaultValue={pkg.public_price} onBlur={e => updateField(pkg.id, 'public_price', parseFloat(e.target.value) || 0)} className="w-full" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Apertura default</label><Input type="time" defaultValue={pkg.default_open_time} onBlur={e => updateField(pkg.id, 'default_open_time', e.target.value)} className="w-full" /></div>
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Cierre default</label><Input type="time" defaultValue={pkg.default_close_time} onBlur={e => updateField(pkg.id, 'default_close_time', e.target.value)} className="w-full" /></div>
              </div>
              <IncludesEditor packageId={pkg.id} initial={pkg.includes || []} onSave={(items) => updateField(pkg.id, 'includes', items)} />
            </div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ========== INCLUDES EDITOR ==========
function IncludesEditor({ packageId, initial, onSave }: { packageId: string; initial: string[]; onSave: (items: string[]) => void }) {
  const [items, setItems] = useState<string[]>(initial)
  const [nv, setNv] = useState('')
  const save = (newItems: string[]) => { setItems(newItems); onSave(newItems) }
  return (
    <div>
      <div className="text-[.55rem] uppercase tracking-wider text-[#c5a55a] mb-2">Incluye:</div>
      <div className="space-y-1 mb-2">{items.map((it, i) => <div key={i} className="flex gap-2"><Input defaultValue={it} onBlur={e => { const n = [...items]; n[i] = e.target.value; save(n) }} className="flex-1 text-xs p-1.5" /><button onClick={() => save(items.filter((_, j) => j !== i))} className="text-red-400/50 text-xs px-1">✕</button></div>)}</div>
      <div className="flex gap-2"><Input value={nv} onChange={e => setNv(e.target.value)} placeholder="Agregar..." className="flex-1 text-xs p-1.5" /><button onClick={() => { if (nv.trim()) { save([...items, nv.trim()]); setNv('') } }} className="px-2 py-1 bg-[#c5a55a]/10 text-[#c5a55a] text-xs">+</button></div>
    </div>
  )
}

// ========== DISCOUNT PACKS ==========
function DiscountPacksPanel({ packages }: { packages: Package[] }) {
  const [packs, setPacks] = useState<DiscountPack[]>([])
  const [nn, setNn] = useState(''); const [nd, setNd] = useState(''); const [nPkg, setNPkg] = useState('')
  const [nPeople, setNPeople] = useState('2'); const [nTotal, setNTotal] = useState('')
  const [showNew, setShowNew] = useState(false)
  useEffect(() => { ld() }, [])
  const ld = async () => { const { data } = await supabase.from('discount_packs').select('*').order('sort_order'); if (data) setPacks(data) }
  const create = async () => {
    if (!nn.trim()) return
    await supabase.from('discount_packs').insert({ name: nn.trim(), description: nd, package_id: nPkg || null, people_count: parseInt(nPeople) || 2, total_price: parseFloat(nTotal) || 0, sort_order: packs.length + 1 })
    setNn(''); setNd(''); setNPkg(''); setNPeople('2'); setNTotal(''); setShowNew(false); ld()
  }
  return (
    <div className="bg-[#132828] border border-[#1e3838] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="font-display text-lg text-[#f5f0e0]">Packs de Descuento</h3><p className="text-[.55rem] text-white/20 mt-0.5">Combos con precio especial (ej: Pack Parejas)</p></div>
        <button onClick={() => setShowNew(!showNew)} className="px-4 py-1.5 border border-[#c5a55a]/20 text-[#c5a55a] text-xs hover:bg-[#c5a55a]/5">{showNew ? 'Cancelar' : '+ Nuevo Pack'}</button>
      </div>
      {showNew && <div className="bg-[#0c1a1a] border border-[#1e3838] p-4 space-y-3">
        <Input value={nn} onChange={e => setNn(e.target.value)} placeholder="Nombre (ej: Pack Parejas)" className="w-full" />
        <Input value={nd} onChange={e => setNd(e.target.value)} placeholder="Descripción" className="w-full" />
        <div className="grid grid-cols-3 gap-3">
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Paquete</label><Select value={nPkg} onChange={e => setNPkg(e.target.value)} className="w-full"><option value="">Todos</option>{packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Personas</label><Input type="number" value={nPeople} onChange={e => setNPeople(e.target.value)} className="w-full" /></div>
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Precio total</label><Input type="number" value={nTotal} onChange={e => setNTotal(e.target.value)} className="w-full" /></div>
        </div>
        <button onClick={create} className="w-full p-2 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold">Crear Pack</button>
      </div>}
      <div className="space-y-2">
        {packs.map(pk => {
          const pkgName = packages.find(p => p.id === pk.package_id)?.name || 'Todos'
          return <div key={pk.id} className="flex items-center justify-between p-3 border border-[#1e3838]">
            <div className="space-y-0.5"><div className="flex items-center gap-2"><span className="text-sm text-[#dcc07a] font-medium">{pk.name}</span><span className="text-[.55rem] px-1.5 py-0.5 bg-white/5 text-white/30">{pk.people_count} pers. · {fm(pk.total_price)}</span></div><div className="text-[.55rem] text-white/20">Aplica a: {pkgName}{pk.description ? ' · ' + pk.description : ''}</div></div>
            <div className="flex gap-1"><button onClick={() => { supabase.from('discount_packs').update({ is_active: !pk.is_active }).eq('id', pk.id).then(ld) }} className={`text-[.55rem] px-2 py-1 ${pk.is_active ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{pk.is_active ? 'On' : 'Off'}</button><button onClick={() => { if (confirm('¿Eliminar?')) supabase.from('discount_packs').delete().eq('id', pk.id).then(ld) }} className="text-[.55rem] px-2 py-1 text-red-400 bg-red-400/10">✕</button></div>
          </div>
        })}
        {packs.length === 0 && <p className="text-xs text-white/20 text-center py-2">Sin packs todavía.</p>}
      </div>
    </div>
  )
}

// ========== EXTRAS EDITOR (with transport) ==========
function ExtrasEditor() {
  const [extras, setExtras] = useState<Extra[]>([])
  const [nn, setNn] = useState(''); const [np, setNp] = useState('')
  useEffect(() => { ld() }, [])
  const ld = async () => { const { data } = await supabase.from('extras').select('*').order('sort_order'); if (data) setExtras(data as Extra[]) }
  const standardExtras = extras.filter(e => e.extra_type !== 'transport')
  const transportExtras = extras.filter(e => e.extra_type === 'transport')
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[.6rem] uppercase tracking-wider text-[#c5a55a] mb-3">Extras estándar</div>
        <div className="space-y-2 mb-4">{standardExtras.map(e => <div key={e.id} className="flex items-center gap-2">
          <Input defaultValue={e.name} onBlur={ev => { supabase.from('extras').update({ name: ev.target.value }).eq('id', e.id).then(ld) }} className="flex-1 text-xs p-1.5" />
          <div className="flex items-center gap-1"><span className="text-xs text-white/30">$</span><Input type="number" defaultValue={e.price} onBlur={ev => { supabase.from('extras').update({ price: parseFloat(ev.target.value) }).eq('id', e.id).then(ld) }} className="w-20 text-xs text-right p-1.5" /></div>
          <button onClick={() => { supabase.from('extras').update({ active: !e.active }).eq('id', e.id).then(ld) }} className={`text-[.55rem] px-2 py-1 ${e.active ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{e.active ? 'On' : 'Off'}</button>
          <button onClick={() => { if (confirm('¿Eliminar?')) supabase.from('extras').delete().eq('id', e.id).then(ld) }} className="text-red-400/40 text-xs">✕</button>
        </div>)}</div>
        <div className="flex gap-2"><Input value={nn} onChange={e => setNn(e.target.value)} placeholder="Nuevo extra" className="flex-1 text-xs p-1.5" /><Input value={np} onChange={e => setNp(e.target.value)} type="number" placeholder="$" className="w-20 text-xs p-1.5" /><button onClick={async () => { if (!nn) return; await supabase.from('extras').insert({ key: nn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now(), name: nn, price: parseFloat(np) || 0, sort_order: extras.length + 1, extra_type: 'standard' }); setNn(''); setNp(''); ld() }} className="px-2 py-1 bg-[#c5a55a]/10 text-[#c5a55a] text-xs">+</button></div>
      </div>
      <div className="border-t border-[#1e3838] pt-4">
        <div className="text-[.6rem] uppercase tracking-wider text-[#c5a55a] mb-1">🚐 Servicio de Transporte</div>
        <p className="text-[.55rem] text-white/20 mb-3">Activá las opciones y configurá los precios</p>
        <div className="space-y-2">{transportExtras.map(e => <div key={e.id} className="flex items-center gap-2">
          <span className="text-xs text-white/50 flex-1">{e.name}</span>
          <div className="flex items-center gap-1"><span className="text-xs text-white/30">$</span><Input type="number" defaultValue={e.price} onBlur={ev => { supabase.from('extras').update({ price: parseFloat(ev.target.value) }).eq('id', e.id).then(ld) }} className="w-24 text-xs text-right p-1.5" /></div>
          <button onClick={() => { supabase.from('extras').update({ active: !e.active }).eq('id', e.id).then(ld) }} className={`text-[.55rem] px-2 py-1 ${e.active ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{e.active ? 'On' : 'Off'}</button>
        </div>)}{transportExtras.length === 0 && <p className="text-[.55rem] text-white/20">Ejecutá schema-update-v5.sql para agregar las opciones de transporte.</p>}</div>
      </div>
    </div>
  )
}

// ========== MANUAL RESERVATION MODAL ==========
function ManualReservationModal({ packages, onClose, onCreated }: { packages: Package[]; onClose: () => void; onCreated: () => void }) {
  const [pkg, setPkg] = useState(packages[0]?.slug || '')
  const [date, setDate] = useState(''); const [adults, setAdults] = useState('1'); const [children, setChildren] = useState('0')
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState('')
  const [notes, setNotes] = useState(''); const [status, setStatus] = useState('paid')
  const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const selectedPkg = packages.find(p => p.slug === pkg)
  const total = (selectedPkg?.public_price || 0) * (parseInt(adults) || 1)
  const create = async () => {
    if (!name.trim() || !phone.trim() || !date) { setError('Completá nombre, teléfono y fecha'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/reservas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experience: pkg, date, adults: parseInt(adults) || 1, children: parseInt(children) || 0, mode: parseInt(adults) === 1 ? 'solo' : parseInt(adults) === 2 ? 'acompanado' : 'grupo', all_inclusive: false, extras: [], user_name: name, user_phone: phone, user_email: email, notes: notes ? '[MANUAL] ' + notes : '[MANUAL]' }) })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      if (status !== 'pending' && data.reserva?.id) { await supabase.from('reservations').update({ status, updated_at: new Date().toISOString() }).eq('id', data.reserva.id) }
      onCreated()
    } catch { setError('Error de conexión') }
    setLoading(false)
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#132828] border border-[#1e3838] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="font-display text-lg text-[#f5f0e0]">Nueva Reserva Manual</h3><button onClick={onClose} className="text-[#c5a55a] text-xl">✕</button></div>
        <div className="space-y-3">
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Paquete</label><Select value={pkg} onChange={e => setPkg(e.target.value)} className="w-full">{packages.filter(p => p.is_active).map(p => <option key={p.slug} value={p.slug}>{p.name} — {fm(p.public_price)}</option>)}</Select></div>
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Fecha</label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Adultos</label><Input type="number" min="1" value={adults} onChange={e => setAdults(e.target.value)} className="w-full" /></div>
            <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Niños (5-11)</label><Input type="number" min="0" value={children} onChange={e => setChildren(e.target.value)} className="w-full" /></div>
          </div>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" className="w-full" />
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="WhatsApp" className="w-full" />
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (opcional)" className="w-full" />
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas internas" className="w-full" />
          <div><label className="block text-[.5rem] uppercase text-white/30 mb-1">Estado</label><Select value={status} onChange={e => setStatus(e.target.value)} className="w-full"><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="completed">Completado</option></Select></div>
          <div className="bg-[#0c1a1a] p-3 border border-[#1e3838] flex justify-between items-center"><span className="text-xs text-white/40">Total estimado</span><span className="font-display text-lg text-[#dcc07a] font-semibold">{fm(total)}</span></div>
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3">{error}</div>}
          <button onClick={create} disabled={loading} className="w-full p-3 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold disabled:opacity-50">{loading ? 'Creando...' : 'Crear Reserva'}</button>
        </div>
      </div>
    </div>
  )
}

// ========== CALENDAR ADMIN ==========
function CalendarAdmin({ config, uc, packages }: { config: any; uc: (f: string, v: any) => Promise<void>; packages: Package[] }) {
  const [events, setEvents] = useState<any[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([])
  const [curMonth, setCurMonth] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') })
  const [selDate, setSelDate] = useState('')
  const [newTitle, setNewTitle] = useState(''); const [newDesc, setNewDesc] = useState(''); const [newExp, setNewExp] = useState('both'); const [newPrice, setNewPrice] = useState('')

  useEffect(() => { ldEv(); ldSch(); ldOv() }, [])
  const ldEv = async () => { const { data } = await supabase.from('special_events').select('*').order('date'); if (data) setEvents(data) }
  const ldSch = async () => { const { data } = await supabase.from('package_schedules').select('*'); if (data) setSchedules(data as Schedule[]) }
  const ldOv = async () => { const { data } = await supabase.from('date_schedule_overrides').select('*'); if (data) setDateOverrides(data as DateOverride[]) }

  const [year, month] = curMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1).getDay()
  const dim = new Date(year, month, 0).getDate()
  const mn = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const gds = (d: number) => year + '-' + String(month).padStart(2, '0') + '-' + String(d).padStart(2, '0')
  const chm = (dir: number) => { const d = new Date(year, month - 1 + dir, 1); setCurMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) }
  const disabled = config.disabled_dates || []
  const isOff = (d: number) => disabled.includes(gds(d))
  const hasEvent = (d: number) => events.some(e => e.date === gds(d) && e.active)
  const toggleDay = (d: number) => { const ds = gds(d); const nw = isOff(d) ? disabled.filter((x: string) => x !== ds) : [...disabled, ds]; uc('disabled_dates', nw) }
  const createEvent = async () => { if (!newTitle || !selDate) return; await supabase.from('special_events').insert({ title: newTitle, description: newDesc, date: selDate, experience: newExp, price_override: newPrice ? parseFloat(newPrice) : null }); setNewTitle(''); setNewDesc(''); setNewPrice(''); ldEv() }
  const dayPricing = config.day_pricing || {}
  const tiers = config.dynamic_pricing_tiers || [{ threshold: 25, recargo_percent: 5 }, { threshold: 50, recargo_percent: 10 }, { threshold: 75, recargo_percent: 20 }, { threshold: 100, recargo_percent: 30 }]
  const updateDay = (day: string, field: string, val: number) => { const p = { ...dayPricing }; if (!p[day]) p[day] = { descuento: 0, recargo: 0, comision_reseller: 10 }; p[day][field] = val; uc('day_pricing', p) }
  const updateTier = (idx: number, field: string, val: number) => { const t = [...tiers]; t[idx] = { ...t[idx], [field]: val }; uc('dynamic_pricing_tiers', t) }
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const dayNamesShort = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
  const saveSchedule = async (pkgId: string, dow: number, field: string, value: any) => {
    const existing = schedules.find(s => s.package_id === pkgId && s.day_of_week === dow)
    if (existing) { await supabase.from('package_schedules').update({ [field]: value }).eq('id', existing.id) }
    else { await supabase.from('package_schedules').insert({ package_id: pkgId, day_of_week: dow, [field]: value }) }
    ldSch()
  }
  const saveDateOverride = async (pkgId: string, date: string, field: string, value: any) => {
    const existing = dateOverrides.find(o => o.package_id === pkgId && o.date === date)
    if (existing) { await supabase.from('date_schedule_overrides').update({ [field]: value }).eq('id', existing.id) }
    else { await supabase.from('date_schedule_overrides').insert({ package_id: pkgId, date, [field]: value }) }
    ldOv()
  }

  return (
    <div className="space-y-6">
      {/* Calendar Grid */}
      <div className="bg-[#132828] border border-[#1e3838] p-6">
        <h3 className="font-display text-lg text-[#f5f0e0] mb-4">Calendario</h3>
        <p className="text-xs text-white/30 mb-4">Click para seleccionar. Doble click para habilitar/deshabilitar. Rojo = cerrado. Rosa = evento.</p>
        <div className="flex items-center justify-between mb-3"><button onClick={() => chm(-1)} className="text-[#c5a55a] text-lg px-2">‹</button><span className="font-display text-sm text-[#f5f0e0]">{mn[month - 1]} {year}</span><button onClick={() => chm(1)} className="text-[#c5a55a] text-lg px-2">›</button></div>
        <div className="grid grid-cols-7 gap-1 text-center text-[.6rem] text-white/30 mb-2">{dayNamesShort.map(d => <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">{Array(firstDay).fill(null).map((_, i) => <div key={'e' + i} />)}{Array(dim).fill(null).map((_, i) => { const d = i + 1, ds = gds(d), off = isOff(d), ev = hasEvent(d), sel = ds === selDate; return (<button key={d} onClick={() => setSelDate(ds)} onDoubleClick={() => toggleDay(d)} className={`p-2 text-xs rounded transition-all ${sel ? 'bg-[#c5a55a] text-[#0c1a1a] font-bold ring-2 ring-[#c5a55a]/50' : off ? 'bg-red-400/10 text-red-400/50 line-through' : ev ? 'text-pink-400 bg-pink-400/10 font-medium' : 'text-[#f5f0e0] hover:bg-[#c5a55a]/10'}`}>{d}</button>) })}</div>

        {selDate && <div className="mt-4 p-4 border border-[#1e3838] bg-[#0c1a1a]/50">
          <div className="flex items-center justify-between mb-3"><span className="text-sm text-[#f5f0e0] font-display">{new Date(selDate + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span><button onClick={() => toggleDay(parseInt(selDate.split('-')[2]))} className={`text-[.6rem] uppercase px-2 py-1 ${isOff(parseInt(selDate.split('-')[2])) ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>{isOff(parseInt(selDate.split('-')[2])) ? 'Habilitar' : 'Cerrar Día'}</button></div>
          <div className="space-y-2 mb-3">
            <div className="text-[.6rem] uppercase tracking-wider text-white/30">Horario especial para este día:</div>
            {packages.map(pkg => { const ov = dateOverrides.find(o => o.package_id === pkg.id && o.date === selDate); return <div key={pkg.id} className="flex items-center gap-2 text-xs"><span className="text-[#dcc07a] w-28 truncate">{pkg.name}</span><Input type="time" defaultValue={ov?.open_time || ''} placeholder={pkg.default_open_time} onBlur={e => saveDateOverride(pkg.id, selDate, 'open_time', e.target.value || null)} className="w-24 text-xs p-1" /><span className="text-white/20">a</span><Input type="time" defaultValue={ov?.close_time || ''} placeholder={pkg.default_close_time} onBlur={e => saveDateOverride(pkg.id, selDate, 'close_time', e.target.value || null)} className="w-24 text-xs p-1" /><button onClick={() => saveDateOverride(pkg.id, selDate, 'is_closed', !(ov?.is_closed))} className={`text-[.5rem] px-2 py-1 ${ov?.is_closed ? 'text-red-400 bg-red-400/10' : 'text-white/20 bg-white/5'}`}>{ov?.is_closed ? 'Cerrado' : 'Abierto'}</button></div> })}
          </div>
          <div className="space-y-2 border-t border-[#1e3838] pt-3"><div className="text-[.6rem] uppercase tracking-wider text-white/30 mb-1">Agregar evento:</div>
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título (ej: Gran Locro)" className="w-full text-xs" />
            <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descripción" className="w-full text-xs" />
            <div className="flex gap-2"><Select value={newExp} onChange={e => setNewExp(e.target.value)} className="flex-1 text-xs"><option value="both">Todos los paquetes</option>{packages.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</Select><Input value={newPrice} onChange={e => setNewPrice(e.target.value)} type="number" placeholder="Precio especial" className="flex-1 text-xs" /></div>
            <button onClick={createEvent} className="w-full p-2 bg-[#c5a55a]/10 text-[#c5a55a] text-xs border border-[#c5a55a]/20">Crear Evento</button></div>
          {events.filter(e => e.date === selDate).map(ev => <div key={ev.id} className="mt-2 flex items-center justify-between p-2 bg-pink-400/5 border border-pink-400/10"><span className="text-xs text-pink-300">🎉 {ev.title}</span><div className="flex gap-1"><button onClick={() => { supabase.from('special_events').update({ active: !ev.active }).eq('id', ev.id).then(ldEv) }} className={`text-[.5rem] px-1 ${ev.active ? 'text-green-400' : 'text-red-400'}`}>{ev.active ? 'On' : 'Off'}</button><button onClick={() => { supabase.from('special_events').delete().eq('id', ev.id).then(ldEv) }} className="text-[.5rem] text-red-400 px-1">✕</button></div></div>)}
        </div>}
      </div>

      {/* HORARIOS POR PAQUETE Y DÍA */}
      <div className="bg-[#132828] border border-[#1e3838] p-6">
        <h3 className="font-display text-lg text-[#f5f0e0] mb-1">Horarios por Paquete</h3>
        <p className="text-xs text-white/30 mb-4">Configurá el horario de cada paquete según el día de la semana. Dejá vacío para usar el default.</p>
        {packages.map(pkg => (
          <div key={pkg.id} className="mb-6 last:mb-0">
            <div className="text-xs text-[#dcc07a] font-medium mb-2">{pkg.name} <span className="text-white/20 font-normal">(default: {pkg.default_open_time} - {pkg.default_close_time})</span></div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-white/30 text-[.55rem] uppercase tracking-wider"><th className="text-left py-1">Día</th><th className="text-center">Apertura</th><th className="text-center">Cierre</th><th className="text-center">Estado</th></tr></thead>
              <tbody>{dayNames.map((dn, dow) => { const sch = schedules.find(s => s.package_id === pkg.id && s.day_of_week === dow); return <tr key={dow} className="border-t border-[#1e3838]"><td className="py-2 text-[#f5f0e0]">{dn}</td><td className="text-center"><Input type="time" defaultValue={sch?.open_time || ''} placeholder={pkg.default_open_time} onBlur={e => saveSchedule(pkg.id, dow, 'open_time', e.target.value || null)} className="w-24 text-xs text-center p-1" /></td><td className="text-center"><Input type="time" defaultValue={sch?.close_time || ''} placeholder={pkg.default_close_time} onBlur={e => saveSchedule(pkg.id, dow, 'close_time', e.target.value || null)} className="w-24 text-xs text-center p-1" /></td><td className="text-center"><button onClick={() => saveSchedule(pkg.id, dow, 'is_closed', !(sch?.is_closed))} className={`text-[.5rem] px-2 py-1 ${sch?.is_closed ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10'}`}>{sch?.is_closed ? 'Cerrado' : 'Abierto'}</button></td></tr> })}</tbody></table></div>
          </div>
        ))}
      </div>

      {/* PRECIOS POR DÍA */}
      <div className="bg-[#132828] border border-[#1e3838] p-6">
        <h3 className="font-display text-lg text-[#f5f0e0] mb-4">Precios por Día</h3>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-white/30 text-[.55rem] uppercase tracking-wider"><th className="text-left py-2">Día</th><th className="text-right text-green-400">Descuento</th><th className="text-right text-red-400">Recargo</th><th className="text-right text-[#c5a55a]">Comisión %</th></tr></thead>
          <tbody>{['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(day => { const d = dayPricing[day] || { descuento: 0, recargo: 0, comision_reseller: 10 }; return (<tr key={day} className="border-t border-[#1e3838]"><td className="py-2 text-[#f5f0e0] font-medium capitalize">{day}</td><td className="text-right"><Input type="number" defaultValue={d.descuento} onBlur={e => updateDay(day, 'descuento', parseFloat(e.target.value) || 0)} className="w-20 text-green-400 text-xs text-right p-1" /></td><td className="text-right"><Input type="number" defaultValue={d.recargo} onBlur={e => updateDay(day, 'recargo', parseFloat(e.target.value) || 0)} className="w-20 text-red-400 text-xs text-right p-1" /></td><td className="text-right"><Input type="number" defaultValue={d.comision_reseller} onBlur={e => updateDay(day, 'comision_reseller', parseFloat(e.target.value) || 0)} className="w-16 text-[#c5a55a] text-xs text-right p-1" /></td></tr>) })}</tbody></table></div>
      </div>

      {/* PRECIOS POR DEMANDA — FIX */}
      <div className="bg-[#132828] border border-[#1e3838] p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg text-[#f5f0e0]">Precios por Demanda</h3>
          <button onClick={async () => { const nv = !config.dynamic_pricing_enabled; await supabase.from('site_config').update({ dynamic_pricing_enabled: nv, updated_at: new Date().toISOString() }).eq('id', 1); uc('dynamic_pricing_enabled', nv) }} className={`px-3 py-1 text-xs font-semibold cursor-pointer ${config.dynamic_pricing_enabled ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>{config.dynamic_pricing_enabled ? 'Activo' : 'Off'}</button>
        </div>
        <div className="bg-[#0c1a1a] border border-[#1e3838] p-3 mb-4 text-xs text-white/40 flex gap-2"><span className="text-[#c5a55a]">ℹ</span><p>Incentivo para aumentar la demanda los días de bajo aforo. Los precios suben automáticamente según la ocupación del día.</p></div>
        {config.dynamic_pricing_enabled && <table className="w-full text-xs"><thead><tr className="text-white/30 text-[.55rem] uppercase"><th className="text-left py-2">Nivel</th><th className="text-left">Umbral</th><th className="text-right">Recargo %</th></tr></thead>
          <tbody>{tiers.map((t: any, i: number) => <tr key={i} className="border-t border-[#1e3838]"><td className="py-2 text-[#f5f0e0]">{['Baja', 'Media', 'Alta', 'Máxima'][i]}</td><td className="text-white/40">{t.threshold}% ({Math.round((config.max_capacity || 60) * t.threshold / 100)} pers.)</td><td className="text-right"><Input type="number" defaultValue={t.recargo_percent} onBlur={e => updateTier(i, 'recargo_percent', parseFloat(e.target.value) || 0)} className="w-16 text-red-400 text-xs text-right p-1" /></td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

// ========== CUPONES ==========
function CouponsPanel({ coupons, reload }: { coupons: any[]; reload: () => Promise<void> }) {
  const [code, setCode] = useState(''); const [cType, setCType] = useState('discount'); const [dType, setDType] = useState('percent'); const [val, setVal] = useState(''); const [maxU, setMaxU] = useState('0'); const [desc, setDesc] = useState(''); const [minP, setMinP] = useState('0')
  const create = async () => { if (!code) return; await supabase.from('coupons').insert({ code: code.toUpperCase(), coupon_type: cType, discount_type: dType, discount_value: parseFloat(val) || 0, max_uses: parseInt(maxU) || 0, description: desc, min_people: parseInt(minP) || 0 }); setCode(''); setVal(''); setDesc(''); reload() }
  return (
    <div className="bg-[#132828] border border-[#1e3838] p-6">
      <h3 className="font-display text-lg text-[#f5f0e0] mb-4">Gestión de Cupones</h3>
      <div className="bg-[#0c1a1a] border border-[#1e3838] p-4 mb-6 space-y-3">
        <div className="text-[.6rem] uppercase tracking-wider text-[#c5a55a] mb-1">Nuevo Cupón</div>
        <div className="grid grid-cols-2 gap-2"><Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" className="font-mono" /><Select value={cType} onChange={e => setCType(e.target.value)}><option value="discount">Descuento</option><option value="2x1">2×1</option><option value="free_extra">Extra Gratis</option></Select></div>
        {cType === 'discount' && <div className="grid grid-cols-2 gap-2"><Select value={dType} onChange={e => setDType(e.target.value)}><option value="percent">Porcentaje %</option><option value="fixed">Monto fijo $</option></Select><Input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="Valor" /></div>}
        <div className="grid grid-cols-3 gap-2">
          <div><label className="block text-[.5rem] uppercase text-white/20 mb-0.5">Max usos</label><Input type="number" value={maxU} onChange={e => setMaxU(e.target.value)} className="w-full" /></div>
          <div><label className="block text-[.5rem] uppercase text-white/20 mb-0.5">Min personas</label><Input type="number" value={minP} onChange={e => setMinP(e.target.value)} className="w-full" /></div>
          <div><label className="block text-[.5rem] uppercase text-white/20 mb-0.5">Nota interna</label><Input value={desc} onChange={e => setDesc(e.target.value)} className="w-full" /></div>
        </div>
        <button onClick={create} className="w-full p-2 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold">Crear Cupón</button>
      </div>
      <div className="space-y-2">{coupons.map(c => <div key={c.id} className="flex items-center justify-between p-3 border border-[#1e3838]">
        <div className="space-y-0.5"><div className="flex items-center gap-2"><span className="font-mono text-sm text-[#dcc07a] font-semibold">{c.code}</span><span className="text-[.55rem] px-1.5 py-0.5 bg-white/5 text-white/30">{c.coupon_type === '2x1' ? '2×1' : c.coupon_type === 'free_extra' ? 'Extra Gratis' : c.discount_type === 'percent' ? c.discount_value + '%' : fm(c.discount_value)}</span></div><div className="text-[.55rem] text-white/20">Usos: {c.used_count}{c.max_uses > 0 ? '/' + c.max_uses : '/∞'}{c.min_people > 0 ? ' · Min ' + c.min_people + ' pers.' : ''}{c.description ? ' · ' + c.description : ''}</div></div>
        <div className="flex gap-1"><button onClick={() => { supabase.from('coupons').update({ active: !c.active }).eq('id', c.id).then(reload) }} className={`text-[.55rem] px-2 py-1 ${c.active ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{c.active ? 'On' : 'Off'}</button><button onClick={() => { if (confirm('¿Eliminar cupón ' + c.code + '?')) supabase.from('coupons').delete().eq('id', c.id).then(reload) }} className="text-[.55rem] px-2 py-1 text-red-400 bg-red-400/10">✕</button></div>
      </div>)}</div>
    </div>
  )
}

// ========== COMMISSION LEVELS ==========
function LevelsPanel() {
  const [levels, setLevels] = useState<any[]>([]); useEffect(() => { ld() }, [])
  const ld = async () => { const { data } = await supabase.from('commission_levels').select('*').order('level'); if (data) setLevels(data) }
  return (
    <div className="bg-[#132828] border border-[#1e3838] p-6"><h3 className="font-display text-lg text-[#f5f0e0] mb-4">Comisiones Multinivel</h3><div className="space-y-2">{levels.map(l => <div key={l.level} className="flex items-center justify-between p-3 border border-[#1e3838]">
      <div className="flex items-center gap-3"><span className="font-display text-2xl text-[#c5a55a]/30">{l.level}</span><div><div className="text-xs text-[#f5f0e0]">Nivel {l.level}</div><div className="text-[.55rem] text-white/20">{l.level === 1 ? 'Referido directo' : 'Nivel ' + l.level}</div></div></div>
      <div className="flex items-center gap-2"><Input type="number" step="0.5" defaultValue={l.percentage} onBlur={e => { supabase.from('commission_levels').update({ percentage: parseFloat(e.target.value) }).eq('level', l.level).then(ld) }} className="w-16 text-[#c5a55a] text-right p-1.5" /><span className="text-xs text-white/30">%</span><button onClick={() => { supabase.from('commission_levels').update({ is_active: !l.is_active }).eq('level', l.level).then(ld) }} className={`text-[.55rem] px-2 py-1 ${l.is_active ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{l.is_active ? 'On' : 'Off'}</button></div>
    </div>)}</div></div>
  )
}

// ========== USERS PANEL (admin) ==========
function UsersPanel() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  useEffect(() => { ld() }, [])
  const ld = async () => { const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false }); if (data) setUsers(data) }

  const updateRole = async (id: string, role: string) => {
    await supabase.from('users').update({ role, updated_at: new Date().toISOString() }).eq('id', id)
    ld()
  }
  const updateUser = async (id: string, field: string, value: any) => {
    await supabase.from('users').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    ld()
  }
  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`¿Eliminar usuario "${email}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('users').delete().eq('id', id)
    ld()
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s) || (u.phone || '').toLowerCase().includes(s)
  })

  const roleColor = (r: string) => r === 'admin' ? 'text-red-400 bg-red-400/10' : r === 'afiliado' ? 'text-[#c5a55a] bg-[#c5a55a]/10' : 'text-white/40 bg-white/5'

  return (
    <div className="bg-[#132828] border border-[#1e3838] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg text-[#f5f0e0]">Gestión de Usuarios</h3>
        <span className="text-xs text-white/30">{users.length} usuarios</span>
      </div>
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, email o teléfono..." className="w-full mb-4" />
      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.id} className="border border-[#1e3838] p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-[#f5f0e0] font-medium truncate">{u.name || 'Sin nombre'}</span>
                  <span className={`text-[.5rem] uppercase tracking-wider px-1.5 py-0.5 ${roleColor(u.role)}`}>{u.role}</span>
                </div>
                <div className="text-[.6rem] text-white/30 mt-0.5">{u.email}{u.phone ? ' · ' + u.phone : ''}</div>
                <div className="text-[.55rem] text-white/15">Creado: {new Date(u.created_at).toLocaleDateString('es-AR')}</div>
              </div>
              <div className="flex gap-1 ml-2 flex-shrink-0">
                <button onClick={() => setEditingId(editingId === u.id ? null : u.id)} className="text-[.55rem] px-2 py-1 text-[#c5a55a] bg-[#c5a55a]/10">✏</button>
                <button onClick={() => deleteUser(u.id, u.email)} className="text-[.55rem] px-2 py-1 text-red-400 bg-red-400/10">✕</button>
              </div>
            </div>
            {editingId === u.id && <div className="border-t border-[#1e3838] mt-2 pt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-0.5">Nombre</label><Input defaultValue={u.name || ''} onBlur={e => updateUser(u.id, 'name', e.target.value)} className="w-full text-xs p-1.5" /></div>
                <div><label className="block text-[.5rem] uppercase text-white/30 mb-0.5">Teléfono</label><Input defaultValue={u.phone || ''} onBlur={e => updateUser(u.id, 'phone', e.target.value)} className="w-full text-xs p-1.5" /></div>
              </div>
              <div>
                <label className="block text-[.5rem] uppercase text-white/30 mb-0.5">Rol</label>
                <div className="flex gap-2">
                  {['cliente', 'afiliado', 'admin'].map(r => (
                    <button key={r} onClick={() => updateRole(u.id, r)} className={`text-[.6rem] uppercase px-3 py-1.5 border ${u.role === r ? 'border-[#c5a55a] bg-[#c5a55a]/10 text-[#c5a55a]' : 'border-[#1e3838] text-white/30'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => updateUser(u.id, 'is_active', !u.is_active)} className={`text-[.6rem] px-3 py-1.5 ${u.is_active ? 'text-green-400 bg-green-400/10 border border-green-400/20' : 'text-red-400 bg-red-400/10 border border-red-400/20'}`}>{u.is_active ? 'Activo' : 'Inactivo'}</button>
              </div>
            </div>}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-white/20 text-xs py-4">No se encontraron usuarios.</p>}
      </div>
    </div>
  )
}

// ========== NEWS ==========
function NewsPanel({ uid }: { uid: string }) {
  const [news, setNews] = useState<any[]>([]); const [t, setT] = useState(''); const [c, setC] = useState(''); const [ed, setEd] = useState<string | null>(null)
  useEffect(() => { ld() }, [])
  const ld = async () => { const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false }); if (data) setNews(data) }
  return (
    <div className="bg-[#132828] border border-[#1e3838] p-6"><h3 className="font-display text-lg text-[#f5f0e0] mb-4">Noticias</h3>
      <div className="space-y-2 mb-6 border-b border-[#1e3838] pb-4"><Input value={t} onChange={e => setT(e.target.value)} placeholder="Título" className="w-full" /><textarea value={c} onChange={e => setC(e.target.value)} placeholder="Contenido" rows={3} className="w-full p-2 bg-[#0f2020] border border-[#1e3838] text-[#f5f0e0] text-sm outline-none focus:border-[#c5a55a] placeholder:text-white/20 resize-none" /><button onClick={async () => { if (!t || !c) return; await supabase.from('news').insert({ title: t, content: c, author_id: uid }); setT(''); setC(''); ld() }} className="w-full p-2 bg-gradient-to-r from-[#c5a55a] to-[#a08840] text-[#0c1a1a] text-sm font-semibold">Crear Noticia</button></div>
      <div className="space-y-2">{news.map(n => <div key={n.id} className="border border-[#1e3838] p-3">
        {ed === n.id ? <div className="space-y-2"><Input defaultValue={n.title} id={'nt' + n.id} className="w-full text-xs p-1.5" /><textarea defaultValue={n.content} id={'nc' + n.id} rows={2} className="w-full p-1.5 bg-[#0f2020] border border-[#1e3838] text-[#f5f0e0] text-xs outline-none resize-none" /><div className="flex gap-2"><button onClick={() => { const ti = (document.getElementById('nt' + n.id) as HTMLInputElement).value; const co = (document.getElementById('nc' + n.id) as HTMLTextAreaElement).value; supabase.from('news').update({ title: ti, content: co }).eq('id', n.id).then(() => { setEd(null); ld() }) }} className="px-2 py-1 bg-[#c5a55a]/10 text-[#c5a55a] text-xs">Guardar</button><button onClick={() => setEd(null)} className="px-2 py-1 text-white/30 text-xs">Cancelar</button></div></div>
          : <div className="flex justify-between"><div><h4 className="text-sm text-[#f5f0e0]">{n.title}</h4><p className="text-xs text-white/30 mt-0.5 line-clamp-1">{n.content}</p></div><div className="flex gap-1 ml-2"><button onClick={() => { supabase.from('news').update({ published: !n.published }).eq('id', n.id).then(ld) }} className={`text-[.5rem] px-2 py-1 ${n.published ? 'text-green-400 bg-green-400/10' : 'text-white/30 bg-white/5'}`}>{n.published ? 'Pub' : 'Draft'}</button><button onClick={() => setEd(n.id)} className="text-[.5rem] px-2 py-1 text-[#c5a55a] bg-[#c5a55a]/10">✏</button><button onClick={() => { if (confirm('¿Eliminar?')) supabase.from('news').delete().eq('id', n.id).then(ld) }} className="text-[.5rem] px-2 py-1 text-red-400 bg-red-400/10">✕</button></div></div>}
      </div>)}</div>
    </div>
  )
}

// ========== RESELLER STOREFRONT (generic) ==========
function StorefrontPanel({ userId, packages }: { userId: string; packages: Package[] }) {
  const [aff, setAff] = useState<any>(null)
  useEffect(() => { supabase.from('affiliates').select('*').eq('user_id', userId).single().then(({ data }) => { if (data) setAff(data) }) }, [userId])
  if (!aff) return <p className="text-white/30 text-sm">No sos afiliado todavía.</p>
  return (
    <div className="bg-[#132828] border border-[#1e3838] p-6 space-y-4">
      <h3 className="font-display text-lg text-[#f5f0e0]">Mi Tienda</h3>
      <p className="text-xs text-white/30">Personalizá los precios que ven tus clientes. Si dejás vacío se usa el precio base.</p>
      <div className="text-xs text-white/40 mb-2">Tu código: <span className="font-mono text-[#dcc07a]">{aff.affiliate_code}</span></div>
      <div className="flex items-center justify-between"><label className="text-xs text-white/50">Tienda habilitada</label><button onClick={() => { supabase.from('affiliates').update({ storefront_enabled: !aff.storefront_enabled }).eq('id', aff.id).then(() => supabase.from('affiliates').select('*').eq('id', aff.id).single().then(({ data }) => { if (data) setAff(data) })) }} className={`px-3 py-1 text-xs ${aff.storefront_enabled ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>{aff.storefront_enabled ? 'On' : 'Off'}</button></div>
      <div className="space-y-3">
        {packages.filter(p => p.is_active).map(pkg => (
          <div key={pkg.id} className="flex items-center justify-between">
            <div><label className="block text-[.6rem] uppercase tracking-wider text-white/30">Precio {pkg.name}</label><span className="text-[.55rem] text-white/15">Mínimo: {fm(pkg.cost_price)} · Base: {fm(pkg.public_price)}</span></div>
            <Input type="number" defaultValue={pkg.slug === 'glow_days' ? aff.custom_glow_price || '' : pkg.slug === 'black_nights' ? aff.custom_black_price || '' : ''} placeholder={String(pkg.public_price)}
              onBlur={e => { const val = e.target.value ? parseFloat(e.target.value) : null; if (val !== null && val < pkg.cost_price) { alert(`El precio mínimo permitido es ${fm(pkg.cost_price)}`); return }; if (pkg.slug === 'glow_days') supabase.from('affiliates').update({ custom_glow_price: val }).eq('id', aff.id); else if (pkg.slug === 'black_nights') supabase.from('affiliates').update({ custom_black_price: val }).eq('id', aff.id) }} className="w-36 text-right" />
          </div>
        ))}
      </div>
      <p className="text-[.6rem] text-white/20">Link de tu tienda: <span className="text-[#c5a55a]">/reservar?ref={aff.affiliate_code}</span></p>
    </div>
  )
}
