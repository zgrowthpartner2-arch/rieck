import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rieck.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { experience, date, adults, children, mode, all_inclusive, extras,
      user_name, user_phone, user_email, affiliate_code, coupon_code, notes,
      payment_choice } = body // payment_choice: 'full' | 'deposit'

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

    // Get package price from packages table
    const { data: pkg } = await supabase.from('packages').select('public_price, name').eq('slug', experience).single()
    const basePrice = pkg?.public_price || (experience === 'glow_days' ? config.glow_price : config.black_price)

    // Check special event
    const { data: event } = await supabase.from('special_events').select('price_override')
      .eq('date', date).eq('active', true).limit(1).maybeSingle()

    const pricePerPerson = event?.price_override ?? basePrice

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

    // Deposit calculation
    const depositEnabled = config.deposit_enabled || false
    const depositPercent = config.deposit_percent || 100
    const isDeposit = depositEnabled && payment_choice === 'deposit' && depositPercent < 100
    const amountToCharge = isDeposit ? Math.round(total * depositPercent / 100) : total
    const amountRemaining = total - amountToCharge

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

    // Create reservation
    const { data: reservation, error } = await supabase.from('reservations').insert({
      code, experience, date, adults, children, mode, all_inclusive,
      extras: extras || [], price_per_person: pricePerPerson, extras_total: extrasTotal,
      discount, subtotal, total, status: 'pending',
      affiliate_id: affiliateId, coupon_code: coupon_code || null,
      affiliate_code_used: affiliate_code || null,
      user_name, user_phone, user_email: user_email || '', notes: notes || '',
      payment_type: isDeposit ? 'deposit' : 'full',
      amount_paid: 0, amount_remaining: total,
      original_date: date
    }).select().single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: 'Error al crear reserva' }, { status: 500 })
    }

    // Create Mercado Pago preference
    let mpInitPoint = null
    if (config.mp_access_token) {
      try {
        const pkgName = pkg?.name || experience
        const itemTitle = isDeposit
          ? `Seña ${depositPercent}% — ${pkgName} (${adults} pers.)`
          : `${pkgName} — ${adults} persona${adults > 1 ? 's' : ''}`

        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.mp_access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: [{
              title: itemTitle,
              quantity: 1,
              unit_price: amountToCharge,
              currency_id: 'ARS'
            }],
            external_reference: code,
            back_urls: {
              success: `${APP_URL}/reservar/confirmado?code=${code}`,
              failure: `${APP_URL}/reservar/confirmado?code=${code}&status=failure`,
              pending: `${APP_URL}/reservar/confirmado?code=${code}&status=pending`
            },
            notification_url: `${APP_URL}/api/webhooks/mercadopago`,
            auto_return: 'approved',
            payment_methods: { installments: 2 }
          })
        })
        const mpPref = await mpRes.json()

        if (mpPref?.id) {
          mpInitPoint = mpPref.init_point
          await supabase.from('reservations').update({
            mp_preference_id: mpPref.id,
            mp_init_point: mpPref.init_point
          }).eq('id', reservation.id)

          await supabase.from('payments').insert({
            reservation_id: reservation.id,
            mp_preference_id: mpPref.id,
            amount: amountToCharge,
            status: 'pending'
          })
        }
      } catch (e) { console.error('MP preference error:', e) }
    }

    return NextResponse.json({
      reserva: { ...reservation, mp_init_point: mpInitPoint },
      mp_init_point: mpInitPoint,
      deposit_enabled: depositEnabled,
      deposit_percent: depositPercent,
      amount_to_charge: amountToCharge,
      amount_remaining: amountRemaining
    })
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

// PATCH: modify reservation (date change, gift)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, action } = body

    const { data: reservation } = await supabase.from('reservations').select('*').eq('code', code).single()
    if (!reservation) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

    const { data: config } = await supabase.from('site_config').select('*').single()
    const maxMods = config?.max_modifications || 2
    const deadlineHours = config?.modification_deadline_hours || 48

    // Check if within deadline
    const eventDate = new Date(reservation.date + 'T12:00')
    const hoursUntilEvent = (eventDate.getTime() - Date.now()) / (1000 * 60 * 60)

    if (action === 'change_date') {
      if (reservation.modification_count >= maxMods) {
        return NextResponse.json({ error: `Máximo ${maxMods} modificaciones permitidas` }, { status: 400 })
      }
      if (hoursUntilEvent < deadlineHours) {
        return NextResponse.json({ error: `No se puede modificar con menos de ${deadlineHours}hs de anticipación` }, { status: 400 })
      }
      const { new_date } = body
      if (!new_date) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })

      await supabase.from('reservations').update({
        date: new_date,
        modification_count: reservation.modification_count + 1,
        updated_at: new Date().toISOString()
      }).eq('id', reservation.id)

      return NextResponse.json({ ok: true, msg: 'Fecha modificada' })
    }

    if (action === 'gift') {
      const { gift_name, gift_phone, gift_email } = body
      if (!gift_name) return NextResponse.json({ error: 'Nombre del destinatario requerido' }, { status: 400 })

      await supabase.from('reservations').update({
        is_gift: true,
        gifted_to_name: gift_name,
        gifted_to_phone: gift_phone || '',
        gifted_to_email: gift_email || '',
        updated_at: new Date().toISOString()
      }).eq('id', reservation.id)

      return NextResponse.json({ ok: true, msg: 'Reserva regalada' })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
