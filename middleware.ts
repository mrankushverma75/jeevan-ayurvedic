import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const session = await auth()
  const path = req.nextUrl.pathname

  // If no session, redirect to login for protected routes
  if (!session) {
    if (path.startsWith('/dashboard') || path.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  const isAdmin = session.user?.role === 'ADMIN'
  const isEmployee = session.user?.role === 'EMPLOYEE'

  // Admin routes
  if (path.startsWith('/admin') && !isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Employee routes
  if (path.startsWith('/dashboard') && !isEmployee && !isAdmin) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}

