import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { experience, date, adults, children, mode, all_inclusive, extras,
            user_name, user_phone, user_email, affiliate_code, coupon_code, notes } = body

    const { data: config } = await supabase.from('site_config').select('*').single()
    if (!config) return NextResponse.json({ error: 'Config not found' }, { status: 500 })

    // Check capacity
    const { data: existing } = await supabase
      .from('reservations').select('adults, children')
      .eq('date', date).eq('experience', experience).neq('status', 'cancelled')
    const totalReserved = (existing || []).reduce((s: number, r: any) => s + r.adults + r.children, 0)
    if (totalReserved + adults + children > config.max_capacity) {
      return NextResponse.json({ error: `Sin disponibilidad. Quedan ${config.max_capacity - totalReserved} lugares.` }, { status: 400 })
    }

    // Pricing
    const basePrice = experience === 'glow_days' ? config.glow_price : config.black_price
    const dow = new Date(date + 'T12:00').getDay()
    const dayAdj = (dow >= 1 && dow <= 4) ? -(config.weekday_discount || 0) : (dow === 0 || dow === 5 || dow === 6) ? (config.weekend_surcharge || 0) : 0
    
    const { data: event } = await supabase.from('special_events').select('price_override')
      .eq('date', date).eq('active', true).limit(1).maybeSingle()
    
    const pricePerPerson = event?.price_override ?? (basePrice + dayAdj)
    
    // Extras
    let extrasTotal = 0
    if (extras && extras.length > 0) {
      const { data: extrasData } = await supabase.from('extras').select('price').in('name', extras)
      extrasTotal = (extrasData || []).reduce((s: number, e: any) => s + e.price, 0) * adults
      if (all_inclusive) extrasTotal = Math.max(0, extrasTotal - (config.all_inclusive_discount || 0) * adults)
    }

    let discount = 0
    if (mode === 'grupo' && adults >= 4) discount = pricePerPerson

    if (coupon_code) {
      const { data: coupon } = await supabase.from('coupons').select('*')
        .eq('code', coupon_code.toUpperCase()).eq('active', true).maybeSingle()
      if (coupon && (coupon.max_uses === 0 || coupon.used_count < coupon.max_uses)) {
        discount += coupon.discount_type === 'percent' 
          ? (pricePerPerson * adults * coupon.discount_value / 100) 
          : coupon.discount_value
        await supabase.from('coupons').update({ used_count: coupon.used_count + 1 }).eq('id', coupon.id)
      }
    }

    const subtotal = pricePerPerson * adults
    const total = Math.max(0, subtotal - discount + extrasTotal)

    // Affiliate
    let affiliateId = null
    if (affiliate_code) {
      const { data: aff } = await supabase.from('affiliates').select('id, is_active')
        .eq('affiliate_code', affiliate_code.toUpperCase()).maybeSingle()
      if (aff?.is_active) affiliateId = aff.id
    }

    // Generate code
    const { data: codeResult } = await supabase.rpc('generate_reservation_code')
    const code = codeResult || `RGD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const { data: reservation, error } = await supabase.from('reservations').insert({
      code, experience, date, adults, children, mode, all_inclusive,
      extras: extras || [], price_per_person: pricePerPerson, extras_total: extrasTotal,
      discount, subtotal, total, status: 'pending',
      affiliate_id: affiliateId, coupon_code: coupon_code || null,
      user_name, user_phone, user_email: user_email || '', notes: notes || ''
    }).select().single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: 'Error al crear reserva' }, { status: 500 })
    }

    // Return as "reserva" to match frontend expectations
    return NextResponse.json({ reserva: reservation })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })
  const { data, error } = await supabase.from('reservations').select('*').eq('code', code.toUpperCase()).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  return NextResponse.json({ reserva: data })
}
