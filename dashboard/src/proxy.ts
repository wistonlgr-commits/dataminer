import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('scrapeflow_auth')?.value
  
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  
  // Si no está autenticado y no está en login, redirigir a login
  if (!authCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Si está autenticado y está en login, redirigir al inicio
  if (authCookie && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  // Proteger todas las rutas excepto los assets estáticos de Next.js
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
