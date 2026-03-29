import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Root path → serve the static landing page
  if (request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/landing.html', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
