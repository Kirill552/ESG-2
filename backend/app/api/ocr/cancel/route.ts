import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getQueueManager } from '@/lib/queue'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions as any) as any
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { documentId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const documentId = body.documentId?.trim()
  if (!documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
  }

  // Ensure ownership
  const doc = await prisma.document.findFirst({ where: { id: documentId, userId: session.user.id }, select: { id: true } })
  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const queue = await getQueueManager()
    const cancelled = await queue.cancelJobsByDocumentId(documentId)
    if (cancelled > 0) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'UPLOADED',
          queueStatus: 'FAILED',
          processingStage: 'cancelled',
          processingMessage: 'Отменено пользователем',
          processingProgress: 0,
          jobId: null,
        }
      })
    }
    return NextResponse.json({ cancelled })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Cancel failed' }, { status: 500 })
  }
}
