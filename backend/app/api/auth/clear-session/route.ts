import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ 
    message: 'Session cleared',
    cookies_cleared: [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.csrf-token',
      '__Host-next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.callback-url',
      'mfa'
    ]
  })
  
  // Очищаем все возможные NextAuth cookies
  const cookiesToClear = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'mfa'
  ]
  
  cookiesToClear.forEach(cookieName => {
    // Очищаем с разными настройками для гарантии
    response.cookies.set(cookieName, '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    })
    
    response.cookies.set(cookieName, '', {
      expires: new Date(0),
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'lax'
    })
    
    response.cookies.delete(cookieName)
  })
  
  return response
}
