import { NextRequest, NextResponse } from 'next/server'
import { isSessionActive } from '@/lib/session-utils'

export async function GET(request: NextRequest) {
  try {
    const isActive = await isSessionActive()
    
    return NextResponse.json({ 
      authenticated: isActive,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json({ 
      authenticated: false,
      error: 'Session check failed'
    }, { status: 500 })
  }
}
