import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getQueueManager } from '@/lib/queue'

export const runtime = 'nodejs'

type CreateBatchBody = {
  documentIds?: string[]
}

export async function POST(req: NextRequest) {
  // Auth
  const session = await getServerSession(authOptions as any) as any
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateBatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.documentIds) ? [...new Set(body.documentIds)].filter(Boolean) : []
  if (!ids.length) {
    return NextResponse.json({ error: 'documentIds is required (non-empty array)' }, { status: 400 })
  }

  try {
    // Load documents belonging to current user
    const docs = await prisma.document.findMany({
      where: { id: { in: ids }, userId: session.user.id },
      select: { id: true, filePath: true, fileName: true, fileSize: true }
    })

    if (!docs.length) {
      return NextResponse.json({ error: 'No documents found for current user' }, { status: 404 })
    }

    const queue = await getQueueManager()

    const enqueued: Array<{ documentId: string; jobId: string | null }> = []

    for (const d of docs) {
      // Dedup: skip if a job already exists for this document
      const existing = await queue.findJobsByDocumentId(d.id)
      if (existing.length > 0) {
        enqueued.push({ documentId: d.id, jobId: existing[0].id })
        continue
      }

      const jobId = await queue.addOcrJob({
        documentId: d.id,
        fileKey: d.filePath,
        fileName: d.fileName,
        fileSize: d.fileSize,
        userId: session.user.id,
      }, { priority: 'normal' })

      // Mark document status to QUEUED and attach jobId
      if (jobId) {
        await prisma.document.update({
          where: { id: d.id },
          data: {
            status: 'QUEUED',
            queueStatus: 'WAITING',
            jobId: jobId,
            processingStartedAt: new Date(),
            processingStage: 'queued',
            processingMessage: 'В очереди на OCR',
            processingProgress: 0,
          }
        })
      }

      enqueued.push({ documentId: d.id, jobId: jobId })
    }

    // Deterministic batchId: userId + sorted doc ids hash (simple base64 of joined string)
    const base = `${session.user.id}|${enqueued.map((e) => e.documentId).sort().join(',')}`
    const batchId = Buffer.from(base).toString('base64url')

    // Запишем метрику батча для мониторинга
    try {
      const { metricsCollector } = await import('@/lib/metrics')
      await metricsCollector.recordCustomMetric('batch', enqueued.length, {
        batchId,
        userId: session.user.id,
        documentIds: enqueued.map(e => e.documentId)
      })
    } catch (e) {
      console.warn('⚠️ Failed to record batch metric', e)
    }

    return NextResponse.json({
      batchId,
      enqueuedCount: enqueued.length,
      documents: enqueued,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to enqueue batch' }, { status: 500 })
  }
}
