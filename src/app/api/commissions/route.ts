import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// GET /api/commissions?user_id=xxx&status=approved
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id')
  const status = req.nextUrl.searchParams.get('status')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Get affiliate id
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!affiliate) return NextResponse.json({ error: 'Not an affiliate' }, { status: 404 })

  let query = supabase
    .from('commissions')
    .select('*, reservations(code, experience, date, total, user_name)')
    .eq('affiliate_id', affiliate.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Summary
  const summary = {
    total_earned: (data || []).reduce((s, c) => s + c.amount, 0),
    pending: (data || []).filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0),
    approved: (data || []).filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0),
    paid: (data || []).filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0),
    by_level: [1, 2, 3, 4, 5].map(l => ({
      level: l,
      count: (data || []).filter(c => c.level === l).length,
      amount: (data || []).filter(c => c.level === l).reduce((s, c) => s + c.amount, 0)
    }))
  }

  return NextResponse.json({ commissions: data || [], summary })
}
