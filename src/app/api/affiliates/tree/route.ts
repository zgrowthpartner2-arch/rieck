import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// GET /api/affiliates/tree?user_id=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Get affiliate
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('*, users(name, email)')
    .eq('user_id', userId)
    .single()

  if (!affiliate) return NextResponse.json({ error: 'Not an affiliate' }, { status: 404 })

  // Build downline tree (recursive, max 5 levels)
  const tree = await buildTree(affiliate.id, 1)

  // Build upline chain
  const upline = await buildUpline(affiliate.parent_affiliate_id)

  return NextResponse.json({ affiliate, tree, upline })
}

async function buildTree(parentId: string, level: number): Promise<any[]> {
  if (level > 5) return []
  
  const { data: children } = await supabase
    .from('affiliates')
    .select('*, users(name, email)')
    .eq('parent_affiliate_id', parentId)
    .eq('is_active', true)

  if (!children || children.length === 0) return []

  const result = []
  for (const child of children) {
    const subTree = await buildTree(child.id, level + 1)
    result.push({ ...child, level, children: subTree })
  }
  return result
}

async function buildUpline(parentId: string | null): Promise<any[]> {
  const chain = []
  let currentId = parentId
  let level = 0
  
  while (currentId && level < 5) {
    const { data: parent } = await supabase
      .from('affiliates')
      .select('*, users(name, email)')
      .eq('id', currentId)
      .single()
    
    if (!parent) break
    chain.push(parent)
    currentId = parent.parent_affiliate_id
    level++
  }
  
  return chain
}
