import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getQueueManager } from '@/lib/queue'

export const runtime = 'nodejs'

function decodeBatchId(batchId: string): { userId: string; docIds: string[] } | null {
  try {
    const raw = Buffer.from(batchId, 'base64url').toString('utf8')
    const [userId, idsJoined] = raw.split('|')
    if (!userId || !idsJoined) return null
    const docIds = idsJoined.split(',').filter(Boolean)
    return { userId, docIds }
  } catch {
    return null
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  const session = await getServerSession(authOptions as any) as any
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: batchId, action } = params
  const decoded = decodeBatchId(batchId)
  if (!decoded) return NextResponse.json({ error: 'Invalid batchId' }, { status: 400 })
  if (decoded.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const queue = await getQueueManager()

  if (action === 'cancel') {
    let total = 0
    for (const docId of decoded.docIds) {
      try {
        const cancelled = await queue.cancelJobsByDocumentId(docId)
        total += cancelled
      } catch { /* ignore one-offs */ }
    }
    return NextResponse.json({ cancelled: total })
  }

  if (action === 'pause' || action === 'resume') {
    // Временно: глобальная пауза очереди OCR
    try {
      if (action === 'pause') await queue.pauseAllOcr();
      else await queue.resumeAllOcr();
      return NextResponse.json({ ok: true, action });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to update queue state' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
