import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data: config } = await supabase.from('site_config').select('mp_access_token').single()
    
    if (!config?.mp_access_token) {
      return NextResponse.json({ error: 'MP not configured' }, { status: 500 })
    }

    // Validate webhook signature (x-signature header)
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')
    if (xSignature && process.env.MP_WEBHOOK_SECRET) {
      const [tsPart, v1Part] = xSignature.split(',').map(p => p.split('=')[1])
      const dataId = body?.data?.id || ''
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${tsPart};`
      const hmac = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update(manifest).digest('hex')
      if (hmac !== v1Part) {
        console.error('Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Handle payment notification
    if (body.type === 'payment' && body.data?.id) {
      const mpPaymentId = String(body.data.id)
      
      // Fetch payment details from MP API
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
        headers: { 'Authorization': `Bearer ${config.mp_access_token}` }
      })
      const mpPayment = await mpRes.json()
      
      if (!mpPayment || mpPayment.error) {
        console.error('MP API error:', mpPayment)
        return NextResponse.json({ error: 'MP fetch failed' }, { status: 400 })
      }

      // Find our payment record by MP payment ID or preference ID
      const externalRef = mpPayment.external_reference // This is our reservation code
      
      let payment = null
      
      // Try to find by mp_payment_id first
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('mp_payment_id', mpPaymentId)
        .single()
      
      if (existingPayment) {
        // Already processed - avoid duplicates
        if (existingPayment.status === 'approved') {
          return NextResponse.json({ ok: true, msg: 'Already processed' })
        }
        payment = existingPayment
      }

      // Find reservation by external_reference (code)
      if (!payment && externalRef) {
        const { data: reservation } = await supabase
          .from('reservations')
          .select('id, total, status')
          .eq('code', externalRef)
          .single()

        if (reservation) {
          // Create payment record
          const { data: newPayment } = await supabase
            .from('payments')
            .insert({
              reservation_id: reservation.id,
              mp_payment_id: mpPaymentId,
              mp_preference_id: mpPayment.preference_id || '',
              mp_status: mpPayment.status,
              amount: mpPayment.transaction_amount,
              payment_method: mpPayment.payment_method_id,
              payer_email: mpPayment.payer?.email,
              raw_webhook: body,
              status: mpPayment.status === 'approved' ? 'approved' : 'pending'
            })
            .select()
            .single()
          payment = newPayment
        }
      }

      if (!payment) {
        console.error('No matching payment/reservation found for:', mpPaymentId)
        return NextResponse.json({ error: 'No match' }, { status: 404 })
      }

      // Update payment status
      const newStatus = mpPayment.status === 'approved' ? 'approved' 
        : mpPayment.status === 'rejected' ? 'rejected'
        : mpPayment.status === 'refunded' ? 'refunded'
        : 'pending'

      await supabase.from('payments')
        .update({ 
          mp_status: mpPayment.status, 
          status: newStatus,
          amount: mpPayment.transaction_amount,
          payment_method: mpPayment.payment_method_id,
          payer_email: mpPayment.payer?.email,
          raw_webhook: body,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id)

      // If approved -> update reservation + calculate commissions
      if (newStatus === 'approved') {
        // Get reservation for deposit handling
        const { data: res } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', payment.reservation_id)
          .single()

        if (res) {
          const amountPaid = (res.amount_paid || 0) + mpPayment.transaction_amount
          const amountRemaining = Math.max(0, res.total - amountPaid)

          // Update reservation status and payment tracking
          await supabase.from('reservations')
            .update({
              status: 'paid',
              amount_paid: amountPaid,
              amount_remaining: amountRemaining,
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.reservation_id)

          // Calculate commissions via DB function
          await supabase.rpc('calculate_commissions', {
            p_reservation_id: res.id,
            p_payment_id: payment.id,
            p_amount: res.total
          })
        }

        // Audit log
        await supabase.from('audit_log').insert({
          action: 'payment_approved',
          entity: 'payments',
          entity_id: payment.id,
          details: { mp_payment_id: mpPaymentId, amount: mpPayment.transaction_amount }
        })
      }

      return NextResponse.json({ ok: true, status: newStatus })
    }

    return NextResponse.json({ ok: true, msg: 'Ignored' })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
