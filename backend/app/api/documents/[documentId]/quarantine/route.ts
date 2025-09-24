import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// POST /api/documents/[documentId]/quarantine?action=release|enforce
export async function POST(request: NextRequest, { params }: { params: { documentId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentId } = params
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'release'

  const doc = await prisma.document.findFirst({ where: { id: documentId, userId: session.user.id } })
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  if (action === 'release') {
    // Разрешить из карантина: переводим в UPLOADED и очищаем сообщение стадии
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'UPLOADED' as any, processingStage: null, processingMessage: null, processingProgress: 0 }
    })
    return NextResponse.json({ success: true, status: 'UPLOADED' })
  }

  if (action === 'enforce') {
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'QUARANTINE' as any, processingStage: 'quarantine' }
    })
    return NextResponse.json({ success: true, status: 'QUARANTINE' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}