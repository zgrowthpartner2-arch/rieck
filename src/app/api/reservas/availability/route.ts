import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  const startDate = month ? `${month}-01` : new Date().toISOString().slice(0, 8) + '01'
  const endDate = month 
    ? new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().slice(0, 10)
    : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)

  const { data: config } = await supabase.from('site_config').select('max_capacity').single()
  const maxCap = config?.max_capacity || 60

  const { data: reservas } = await supabase
    .from('reservations').select('date, experience, adults, children')
    .gte('date', startDate).lte('date', endDate).neq('status', 'cancelled')

  const days: Record<string, { glow: number; black: number }> = {}
  for (const r of (reservas || [])) {
    if (!days[r.date]) days[r.date] = { glow: 0, black: 0 }
    const count = r.adults + r.children
    if (r.experience === 'glow_days') days[r.date].glow += count
    else days[r.date].black += count
  }

  return NextResponse.json({ days, max_capacity: maxCap })
}
