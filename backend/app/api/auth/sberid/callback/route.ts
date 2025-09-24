import { NextRequest, NextResponse } from 'next/server'
import { getSberIdService } from '@/lib/sberid-service'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code) {
    return NextResponse.json({ error: 'missing_code' }, { status: 400 })
  }
  // TODO: проверить соответствие state/nonce из хранилища
  void state

  const service = getSberIdService()
  const tokens = await service.exchangeCodeForTokens(code)

  // Если пришёл id_token — провалидировать
  if (tokens.id_token) {
    try {
      await service.verifyIdToken(tokens.id_token)
    } catch (e) {
      return NextResponse.json({ error: 'id_token_verify_failed', details: String(e) }, { status: 400 })
    }
  }

  // На этапе заготовки: просто возвращаем токены как JSON (без сессий, без замены Clerk)
  return NextResponse.json({ ok: true, tokens })
}


