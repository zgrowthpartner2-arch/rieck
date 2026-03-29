import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// GET /api/admin?action=commission_levels|affiliates|stats
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  if (action === 'commission_levels') {
    const { data } = await supabase.from('commission_levels').select('*').order('level')
    return NextResponse.json({ levels: data || [] })
  }

  if (action === 'affiliates') {
    const { data } = await supabase
      .from('affiliates')
      .select('*, users(name, email, phone)')
      .order('created_at', { ascending: false })
    return NextResponse.json({ affiliates: data || [] })
  }

  if (action === 'stats') {
    const { data: reservations } = await supabase.from('reservations').select('total, status')
    const { data: commissions } = await supabase.from('commissions').select('amount, status')
    const { data: users } = await supabase.from('users').select('role')
    const { data: affiliates } = await supabase.from('affiliates').select('is_active')

    const totalRevenue = (reservations || []).filter(r => r.status === 'paid').reduce((s, r) => s + r.total, 0)
    const totalPending = (reservations || []).filter(r => r.status === 'pending').reduce((s, r) => s + r.total, 0)
    const totalCommissions = (commissions || []).filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0)
    
    return NextResponse.json({
      stats: {
        total_reservations: (reservations || []).length,
        paid_reservations: (reservations || []).filter(r => r.status === 'paid').length,
        pending_reservations: (reservations || []).filter(r => r.status === 'pending').length,
        total_revenue: totalRevenue,
        total_pending: totalPending,
        total_commissions: totalCommissions,
        net_revenue: totalRevenue - totalCommissions,
        total_users: (users || []).length,
        total_affiliates: (affiliates || []).length,
        active_affiliates: (affiliates || []).filter(a => a.is_active).length
      }
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// PUT /api/admin - update commission levels, toggle affiliates, etc
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  // Update commission level percentage
  if (action === 'update_level') {
    const { level, percentage, is_active } = body
    const updates: any = { updated_at: new Date().toISOString() }
    if (percentage !== undefined) updates.percentage = percentage
    if (is_active !== undefined) updates.is_active = is_active
    
    await supabase.from('commission_levels').update(updates).eq('level', level)
    return NextResponse.json({ ok: true })
  }

  // Toggle affiliate active
  if (action === 'toggle_affiliate') {
    const { affiliate_id, is_active } = body
    await supabase.from('affiliates').update({ is_active }).eq('id', affiliate_id)
    return NextResponse.json({ ok: true })
  }

  // Create affiliate from user
  if (action === 'create_affiliate') {
    const { user_id, parent_affiliate_id } = body
    const { data: user } = await supabase.from('users').select('name').eq('id', user_id).single()
    
    const { data: codeResult } = await supabase.rpc('generate_affiliate_code', { user_name: user?.name || 'AFF' })
    const code = codeResult || `AFF-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    
    // Calculate level
    let level = 1
    if (parent_affiliate_id) {
      const { data: parent } = await supabase.from('affiliates').select('level').eq('id', parent_affiliate_id).single()
      if (parent) level = Math.min(parent.level + 1, 5)
    }

    const { data, error } = await supabase.from('affiliates').insert({
      user_id, parent_affiliate_id: parent_affiliate_id || null,
      affiliate_code: code, level, is_active: true
    }).select().single()

    // Update user role
    await supabase.from('users').update({ role: 'afiliado' }).eq('id', user_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ affiliate: data })
  }

  // Mark commission as paid
  if (action === 'pay_commission') {
    const { commission_id } = body
    await supabase.from('commissions')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', commission_id)
    return NextResponse.json({ ok: true })
  }

  // Bulk pay commissions for affiliate
  if (action === 'pay_all_commissions') {
    const { affiliate_id } = body
    await supabase.from('commissions')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('affiliate_id', affiliate_id)
      .eq('status', 'approved')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
