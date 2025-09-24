import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSberIdService } from '@/lib/sberid-service'

export async function GET(_req: NextRequest) {
  const state = crypto.randomBytes(16).toString('hex')
  const nonce = crypto.randomBytes(16).toString('hex')

  // В проде: сохранить state/nonce в сессии/куки для проверки в callback
  const service = getSberIdService()
  const url = await service.buildAuthorizationUrl({ state, nonce })
  return NextResponse.redirect(url.toString())
}


