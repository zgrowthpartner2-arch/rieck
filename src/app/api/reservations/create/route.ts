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

    // 1. Get config
    const { data: config } = await supabase.from('site_config').select('*').single()
    if (!config) return NextResponse.json({ error: 'Config not found' }, { status: 500 })

    // 2. Check capacity
    const { data: existing } = await supabase
      .from('reservations').select('adults, children')
      .eq('date', date).eq('experience', experience).neq('status', 'cancelled')
    const totalReserved = (existing || []).reduce((s, r) => s + r.adults + r.children, 0)
    if (totalReserved + adults + children > config.max_capacity) {
      return NextResponse.json({ error: `Sin disponibilidad. Quedan ${config.max_capacity - totalReserved} lugares.` }, { status: 400 })
    }

    // 3. Calculate pricing
    const basePrice = experience === 'glow_days' ? config.glow_price : config.black_price
    
    // Day-based adjustment
    const dow = new Date(date + 'T12:00').getDay()
    const dayAdj = (dow >= 1 && dow <= 4) ? -(config.weekday_discount || 0) : (dow === 0 || dow === 5 || dow === 6) ? (config.weekend_surcharge || 0) : 0
    
    // Check special event
    const { data: event } = await supabase.from('special_events').select('price_override')
      .eq('date', date).eq('active', true)
      .or(`experience.eq.${experience},experience.eq.both`).limit(1).single()
    
    const pricePerPerson = event?.price_override ?? (basePrice + dayAdj)
    
    // Extras
    let extrasTotal = 0
    if (extras && extras.length > 0) {
      const { data: extrasData } = await supabase.from('extras').select('price').in('name', extras)
      extrasTotal = (extrasData || []).reduce((s, e) => s + e.price, 0) * adults
      if (all_inclusive) extrasTotal = Math.max(0, extrasTotal - (config.all_inclusive_discount || 0) * adults)
    }

    // Group discount
    let discount = 0
    if (mode === 'grupo' && adults >= 4) discount = pricePerPerson

    // Coupon
    if (coupon_code) {
      const { data: coupon } = await supabase.from('coupons').select('*')
        .eq('code', coupon_code.toUpperCase()).eq('active', true).single()
      if (coupon && (coupon.max_uses === 0 || coupon.used_count < coupon.max_uses)) {
        discount += coupon.discount_type === 'percent' 
          ? (pricePerPerson * adults * coupon.discount_value / 100) 
          : coupon.discount_value
        await supabase.from('coupons').update({ used_count: coupon.used_count + 1 }).eq('id', coupon.id)
      }
    }

    const subtotal = pricePerPerson * adults
    const total = Math.max(0, subtotal - discount + extrasTotal)

    // 4. Resolve affiliate
    let affiliateId = null
    if (affiliate_code) {
      const { data: aff } = await supabase.from('affiliates').select('id, is_active')
        .eq('affiliate_code', affiliate_code.toUpperCase()).single()
      if (aff?.is_active) {
        affiliateId = aff.id
        await supabase.from('affiliates').update({ total_referrals: supabase.rpc ? undefined : 0 }).eq('id', aff.id) // increment handled separately
      }
    }

    // 5. Generate code + create reservation
    const { data: codeResult } = await supabase.rpc('generate_reservation_code')
    const code = codeResult || `RGD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const { data: reservation, error } = await supabase.from('reservations').insert({
      code, experience, date, adults, children, mode, all_inclusive,
      extras: extras || [], price_per_person: pricePerPerson, extras_total: extrasTotal,
      discount, subtotal, total, status: 'pending',
      affiliate_id: affiliateId, coupon_code: coupon_code || null,
      user_name, user_phone, user_email: user_email || '', notes: notes || ''
    }).select().single()

    if (error) return NextResponse.json({ error: 'Error al crear reserva' }, { status: 500 })

    // 6. Create Mercado Pago preference (if configured)
    let mpPreference = null
    if (config.mp_access_token) {
      try {
        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${config.mp_access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: [{
              title: `Rieck ${experience === 'glow_days' ? 'Glow Days' : 'Black Nights'} - ${adults} persona${adults > 1 ? 's' : ''}`,
              quantity: 1,
              unit_price: total,
              currency_id: 'ARS'
            }],
            external_reference: code,
            back_urls: {
              success: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reservar/confirmado?code=${code}`,
              failure: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reservar?error=payment_failed`,
              pending: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reservar/confirmado?code=${code}&pending=true`
            },
            notification_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/mercadopago`,
            auto_return: 'approved',
            payment_methods: {
              installments: 2
            }
          })
        })
        mpPreference = await mpRes.json()
        
        // Create payment record
        if (mpPreference?.id) {
          await supabase.from('payments').insert({
            reservation_id: reservation.id,
            mp_preference_id: mpPreference.id,
            amount: total,
            status: 'pending'
          })
        }
      } catch (e) { console.error('MP preference error:', e) }
    }

    return NextResponse.json({ 
      reservation, 
      mp_init_point: mpPreference?.init_point || null,
      mp_sandbox_init_point: mpPreference?.sandbox_init_point || null
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })
  const { data, error } = await supabase.from('reservations').select('*').eq('code', code.toUpperCase()).single()
  if (error || !data) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  return NextResponse.json({ reservation: data })
}
