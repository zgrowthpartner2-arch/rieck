import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// GET - list news (public: published only; admin: all)
export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get('all') === 'true'
  
  let query = supabase.from('news').select('*, users(name)').order('created_at', { ascending: false })
  if (!all) query = query.eq('published', true)
  
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ news: data || [] })
}

// POST - create news
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, content, image_url, published, author_id } = body

  if (!title || !content) return NextResponse.json({ error: 'Title and content required' }, { status: 400 })

  const { data, error } = await supabase.from('news').insert({
    title, content, image_url: image_url || null,
    published: published ?? false, author_id: author_id || null
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ news: data })
}

// PUT - update news
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, title, content, image_url, published } = body

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data, error } = await supabase.from('news').update({
    title, content, image_url, published, updated_at: new Date().toISOString()
  }).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ news: data })
}

// DELETE - delete news
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await supabase.from('news').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
