import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ids = searchParams.getAll('id')
  const batchId = searchParams.get('batchId') || undefined
  const filter = searchParams.get('filter') || undefined // e.g. status=PROCESSING|FAILED

  const session = await getServerSession(authOptions as any) as any
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!ids.length && !batchId) {
    return new Response('Bad Request: pass ?id=docId&id=docId2 or ?batchId=... ', { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      // helper to send event
      const send = (event: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      // initial snapshot
      try {
        const where: any = { userId: session.user.id }
        if (ids.length) where.id = { in: ids }
        if (filter) {
          // минимальная поддержка фильтра по статусу: filter="status=PROCESSING" или "status=FAILED,PROCESSING"
          const [k, v] = filter.split('=')
          if (k === 'status' && v) {
            const statuses = v.split(',').map(s => s.trim()).filter(Boolean)
            if (statuses.length) where.status = { in: statuses as any }
          }
        }
        const docs = await prisma.document.findMany({
          where,
          select: {
            id: true, status: true, processingProgress: true, processingStage: true,
            processingMessage: true, updatedAt: true, jobId: true, queueStatus: true
          }
        })
        send({ type: 'snapshot', docs, batchId })
      } catch (e: any) {
        send({ type: 'error', message: e?.message || 'Failed to load snapshot' })
      }

      // polling loop (simple; can be replaced by db notifications or boss publish)
      let active = true
      const interval = setInterval(async () => {
        if (!active) return
        try {
          const where: any = { userId: session.user.id }
          if (ids.length) where.id = { in: ids }
          if (filter) {
            const [k, v] = filter.split('=')
            if (k === 'status' && v) {
              const statuses = v.split(',').map(s => s.trim()).filter(Boolean)
              if (statuses.length) where.status = { in: statuses as any }
            }
          }
          const docs = await prisma.document.findMany({
            where,
            select: {
              id: true, status: true, processingProgress: true, processingStage: true,
              processingMessage: true, updatedAt: true, jobId: true, queueStatus: true
            }
          })
          send({ type: 'update', docs, batchId })
          // stop automatically when all finished
          const done = docs.every(d => d.status === 'PROCESSED' || d.status === 'FAILED')
          if (done) {
            send({ type: 'done' })
            clearInterval(interval)
            active = false
            controller.close()
          }
        } catch (e: any) {
          send({ type: 'error', message: e?.message || 'Polling failed' })
        }
      }, 2000)

      // close handler
      const close = () => {
        if (active) {
          clearInterval(interval)
          active = false
          controller.close()
        }
      }

      // AbortSignal support
      req.signal.addEventListener('abort', close)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}
