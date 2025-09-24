import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getQueueManager } from '@/lib/queue';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { documentId } = await params;

    // Находим пользователя в БД
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Проверяем, существует ли документ и принадлежит ли он пользователю
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id
      }
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Перед удалением: отменяем связанные задания в очереди
    try {
      const queueManager = await getQueueManager();
      if ((document as any).jobId) {
        await queueManager.cancelJob((document as any).jobId);
      } else {
        await queueManager.cancelJobsByDocumentId(documentId);
      }
    } catch (queueErr) {
      console.warn('⚠️ Не удалось отменить задачи очереди при удалении документа:', (queueErr as Error).message);
    }

    // Удаляем документ из базы данных
    await prisma.document.delete({
      where: {
        id: documentId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete Document Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
