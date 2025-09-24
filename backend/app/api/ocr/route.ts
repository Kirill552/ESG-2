﻿import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getQueueManager } from '@/lib/queue';
import { JobStatus } from '@/types/queue';
import { RateLimiter } from '@/lib/rate-limiter';
import { getUserInternalId } from '@/lib/user-utils';

/**
 * Получение позиции задачи в очереди
 */
async function getQueuePosition(queueManager: any, jobId: string): Promise<number | null> {
  try {
    const stats = await queueManager.getQueueStats();
    // Примерная позиция на основе количества ожидающих задач
    return stats.waiting || 0;
  } catch (error) {
    console.error('⚠️ Ошибка получения позиции в очереди:', error);
    return null;
  }
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const orgId = session?.user?.organizationId;
    if (!session?.user?.id || !userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Получаем внутренний ID пользователя для rate limiting
    const internalUserId = await getUserInternalId();
    if (!internalUserId) {
      console.error('❌ Не удалось получить внутренний ID пользователя:', { userId });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Используем organizationId или internalUserId как fallback
    const organizationId = orgId || internalUserId;

    // Проверка rate limiting для OCR API (более строгие лимиты чем upload)
    const rateLimiter = new RateLimiter({
      windowSizeMs: 60 * 1000, // 1 минута
      subscriptionLimits: {
        FREE: 3,
        LITE: 8,
        STANDARD: 12,
        LARGE: 20,
        ENTERPRISE: 30
      }
    });
    
    try {
      const rateLimitResult = await rateLimiter.checkLimit(organizationId);
      
      if (!rateLimitResult.allowed) {
        console.log('⚠️ Rate limit exceeded for OCR API:', { 
          organizationId, 
          reason: rateLimitResult.reason,
          remaining: rateLimitResult.remaining,
          retryAfter: rateLimitResult.retryAfter
        });
        
        return NextResponse.json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            message: `Превышен лимит запросов для OCR. Тип подписки: ${rateLimitResult.subscriptionType}`,
            retryAfter: rateLimitResult.retryAfter || 60,
            subscriptionType: rateLimitResult.subscriptionType
          }
        }, { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining)
          }
        });
      }
      
      console.log('✅ Rate limit check passed for OCR API:', { 
        organizationId, 
        remaining: rateLimitResult.remaining,
        subscriptionType: rateLimitResult.subscriptionType
      });
    } catch (error: any) {
      console.error('❌ Rate limiter error for OCR API:', error);
      // В случае ошибки продолжаем работу (fail-open approach)
    }

    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    console.log('🔍 OCR POST request received:', { documentId, userId, orgId });

    // Проверяем surge для постановки приоритета
    const surgePricingService = require('@/lib/surge-pricing').surgePricingService;
    const isSurgePeriod = surgePricingService.isSurgePeriod();

    // Находим документ в БД
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        user: { id: userId }
      },
      include: {
        user: true
      }
    });

    if (!document) {
      return NextResponse.json({
        success: false,
        error: 'Document not found'
      }, { status: 404 });
    }

    console.log('🔍 Найден документ для OCR:', { documentId, fileName: document.fileName });

    try {
      // Проверяем, что документ еще не обрабатывается
      if (document.status === 'QUEUED' || document.status === 'PROCESSING') {
        return NextResponse.json({
          success: false,
          error: 'Document is already being processed',
          data: {
            documentId,
            status: document.status.toLowerCase(),
            jobId: document.jobId,
            progress: document.processingProgress || 0
          }
        }, { status: 409 }); // 409 Conflict
      }

      // Добавляем задачу в очередь вместо синхронной обработки
      console.log('🚀 Добавление OCR задачи в очередь...');
      const queueManager = await getQueueManager();

      // Определяем приоритет задачи (surge-pricing = high priority)
      const priority = isSurgePeriod ? 'high' : 'normal';

      const jobId = await queueManager.addOcrJob({
        documentId,
        fileKey: document.filePath,
        fileName: document.fileName,
        fileSize: document.fileSize,
        userId,
        organizationId
      }, { priority });

      if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
        throw new Error('Failed to add job to queue - no valid job ID returned');
      }

      // Обновляем статус документа на QUEUED с отслеживанием прогресса
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'QUEUED',
          ocrProcessed: false,
          processingProgress: 0,
          processingStage: 'queued',
          processingMessage: `Задача добавлена в очередь с приоритетом ${priority}`,
          jobId: jobId
        }
      });

      console.log('✅ OCR задача добавлена в очередь:', {
        jobId,
        documentId,
        priority,
        fileName: document.fileName,
        fileSize: document.fileSize
      });

      // Инкрементируем счетчик rate limiter после успешного добавления в очередь
      try {
        await rateLimiter.incrementCounter(organizationId);
        console.log('✅ Rate limiter counter incremented for OCR API:', { organizationId });
      } catch (rateLimiterError: any) {
        console.error('⚠️ Failed to increment rate limiter counter:', rateLimiterError);
        // Не прерываем выполнение, так как задача уже добавлена в очередь
      }

      // Возвращаем job ID вместо немедленного результата OCR
      return NextResponse.json({
        success: true,
        data: {
          documentId,
          jobId,
          status: 'queued',
          priority,
          message: `Document queued for OCR processing with ${priority} priority`,
          estimatedProcessingTime: priority === 'high' ? '1-2 minutes' : '2-5 minutes',
          queuePosition: await getQueuePosition(queueManager, jobId),
          // Информация о стоимости для будущей монетизации
          billing: undefined
        }
      });

    } catch (queueError: any) {
      console.error('❌ Ошибка добавления в очередь:', queueError.message);

      // Сохраняем ошибку в БД с детальной информацией
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          processingStage: 'queue_error',
          processingMessage: 'Ошибка добавления в очередь',
          ocrData: {
            error: queueError.message,
            errorType: 'QUEUE_ERROR',
            processedAt: new Date().toISOString(),
            retryable: true
          }
        }
      });

      // Определяем тип ошибки для правильного HTTP кода
      let statusCode = 500;
      let errorCode = 'QUEUE_ERROR';

      if (queueError.message.includes('connection') || queueError.message.includes('timeout')) {
        statusCode = 503; // Service Unavailable
        errorCode = 'QUEUE_UNAVAILABLE';
      } else if (queueError.message.includes('limit') || queueError.message.includes('capacity')) {
        statusCode = 429; // Too Many Requests
        errorCode = 'QUEUE_FULL';
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to queue OCR job',
        code: errorCode,
        details: queueError.message,
        retryable: true,
        retryAfter: statusCode === 503 ? 30 : 60 // секунды
      }, { status: statusCode });
    }

  } catch (error: any) {
    console.error('❌ OCR API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal Server Error'
    }, { status: 500 });
  }
}

/**
 * GET /api/ocr - Проверка статуса задач OCR
 * Обновлено для задачи 6.2: полноценная проверка статуса задач в BullMQ
 * Требования: 4.1, 4.2, 4.3
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const orgId = session?.user?.organizationId;
    if (!session?.user?.id || !userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const jobId = searchParams.get('jobId');

    console.log('🔍 OCR GET request:', { documentId, jobId, userId, orgId });

    // Используем organizationId или userId как fallback
    const organizationId = orgId || userId;

    // Случай 1: Проверка статуса по jobId (приоритет)
    if (jobId) {
      return await handleJobStatusCheck(jobId, userId, organizationId);
    }

    // Случай 2: Проверка статуса по documentId
    if (documentId) {
      return await handleDocumentStatusCheck(documentId, userId, organizationId);
    }

    // Случай 3: Ошибка - нужен либо documentId, либо jobId
    return NextResponse.json({
      success: false,
      error: 'Either documentId or jobId is required',
      code: 'MISSING_PARAMETERS'
    }, { status: 400 });

  } catch (error: any) {
    console.error('❌ OCR GET API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Проверка статуса задачи по jobId (требование 4.1)
 */
async function handleJobStatusCheck(jobId: string, userId: string, organizationId: string) {
  try {
    console.log(`🔍 Проверка статуса задачи: ${jobId}`);

    const queueManager = await getQueueManager();
    const jobStatus = await queueManager.getJobStatus(jobId);

    if (!jobStatus) {
      return NextResponse.json({
        success: false,
        error: 'Job not found in queue',
        code: 'JOB_NOT_FOUND'
      }, { status: 404 });
    }

    // Проверяем права доступа к задаче
    if ((jobStatus as any).data && (jobStatus as any).data.userId !== userId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied to this job',
        code: 'ACCESS_DENIED'
      }, { status: 403 });
    }

    console.log('📊 Job status from queue:', jobStatus);

    // Получаем дополнительную информацию из БД если есть documentId
    let documentInfo = null;
    if ((jobStatus as any).data && (jobStatus as any).data.documentId) {
      documentInfo = await prisma.document.findFirst({
        where: {
          id: (jobStatus as any).data.documentId,
          user: { id: userId }
        },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          status: true,
          processingProgress: true,
          processingStage: true,
          processingMessage: true,
          ocrProcessed: true,
          ocrData: true,
          ocrConfidence: true,
          createdAt: true,
          updatedAt: true
        }
      });
    }

    // Формируем ответ согласно требованию 4.1
    const responseData = {
      jobId,
      status: mapQueueStatusToApiStatus(jobStatus.status),
      progress: jobStatus.progress || 0,
      priority: jobStatus.priority || 'normal',
      createdAt: jobStatus.createdAt,
      processedAt: jobStatus.processedAt,
      finishedAt: (jobStatus as any).finishedAt,
      // Информация о документе
      document: documentInfo ? {
        id: documentInfo.id,
        fileName: documentInfo.fileName,
        fileSize: documentInfo.fileSize,
        dbStatus: documentInfo.status,
        processingProgress: documentInfo.processingProgress,
        processingStage: documentInfo.processingStage,
        processingMessage: documentInfo.processingMessage
      } : null,
      // Результаты OCR если завершено (требование 4.2)
      ocrResults: getOcrResults(jobStatus, documentInfo),
      // Информация об ошибке если есть (требование 4.3)
      error: getErrorInfo(jobStatus, documentInfo),
      // Метаданные задачи
      metadata: (jobStatus as any).data || {}
    };

    console.log(`✅ Статус задачи ${jobId}: ${responseData.status}`);

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error: any) {
    console.error(`❌ Ошибка получения статуса задачи ${jobId}:`, error);

    // Специальная обработка ошибок подключения к очереди
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      return NextResponse.json({
        success: false,
        error: 'Queue service temporarily unavailable',
        code: 'QUEUE_UNAVAILABLE',
        retryAfter: 30
      }, { status: 503 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to get job status',
      code: 'JOB_STATUS_ERROR',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Проверка статуса документа по documentId (требование 4.1)
 */
async function handleDocumentStatusCheck(documentId: string, userId: string, organizationId: string) {
  try {
    console.log(`🔍 Проверка статуса документа: ${documentId}`);

    // Находим документ в БД
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        user: { id: userId }
      },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        status: true,
        processingProgress: true,
        processingStage: true,
        processingMessage: true,
        jobId: true,
        ocrProcessed: true,
        ocrData: true,
        ocrConfidence: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!document) {
      return NextResponse.json({
        success: false,
        error: 'Document not found',
        code: 'DOCUMENT_NOT_FOUND'
      }, { status: 404 });
    }

    // Получаем статус из очереди если есть jobId
    let jobStatus = null;
    if (document.jobId) {
      try {
        const queueManager = await getQueueManager();
        jobStatus = await queueManager.getJobStatus(document.jobId);
        console.log('📊 Job status from queue:', jobStatus);
      } catch (queueError) {
        console.warn(`⚠️ Не удалось получить статус задачи ${document.jobId}:`, (queueError as Error).message);
        // Продолжаем с данными из БД
      }
    }

    // Определяем актуальный статус (приоритет статусу из очереди)
    let actualStatus = mapDbStatusToApiStatus(document.status);
    let actualProgress = document.processingProgress || 0;
    let actualStage = document.processingStage || 'unknown';

    if (jobStatus) {
      actualStatus = mapQueueStatusToApiStatus(jobStatus.status);
      if (jobStatus.progress !== undefined) {
        actualProgress = jobStatus.progress;
      }
      if (jobStatus.status === 'active') {
        actualStage = 'processing';
      } else if (jobStatus.status === 'completed') {
        actualStage = 'completed';
      } else if (jobStatus.status === 'failed') {
        actualStage = 'failed';
      }
    }

    // Формируем ответ
    const responseData = {
      documentId: document.id,
      fileName: document.fileName,
      fileSize: document.fileSize,
      status: actualStatus,
      progress: actualProgress,
      stage: actualStage,
      message: document.processingMessage || '',
      jobId: document.jobId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      // Информация из очереди
      queueInfo: jobStatus ? {
        status: jobStatus.status,
        progress: jobStatus.progress,
        priority: jobStatus.priority,
        createdAt: jobStatus.createdAt,
        processedAt: jobStatus.processedAt,
        finishedAt: (jobStatus as any).finishedAt
      } : null,
      // Результаты OCR если завершено (требование 4.2)
      ocrResults: getOcrResults(jobStatus, document),
      // Информация об ошибке если есть (требование 4.3)
      error: getErrorInfo(jobStatus, document)
    };

    console.log(`✅ Статус документа ${documentId}: ${actualStatus}`);

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error: any) {
    console.error(`❌ Ошибка получения статуса документа ${documentId}:`, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get document status',
      code: 'DOCUMENT_STATUS_ERROR',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Маппинг статуса очереди в API статус
 */
function mapQueueStatusToApiStatus(queueStatus: string): string {
  switch (queueStatus) {
    case 'waiting':
      return 'queued';
    case 'active':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'unknown';
  }
}

/**
 * Маппинг статуса БД в API статус
 */
function mapDbStatusToApiStatus(dbStatus: string): string {
  switch (dbStatus) {
    case 'QUEUED':
      return 'queued';
    case 'PROCESSING':
      return 'processing';
    case 'PROCESSED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    default:
      return 'not_started';
  }
}

/**
 * Получение результатов OCR (требование 4.2)
 */
function getOcrResults(jobStatus: any, documentInfo: any) {
  // Приоритет результатам из задачи
  if (jobStatus && jobStatus.result) {
    return {
      text: jobStatus.result.text,
      textLength: jobStatus.result.textLength,
      confidence: jobStatus.result.confidence,
      processedAt: jobStatus.result.processedAt,
      textPreview: jobStatus.result.text ? jobStatus.result.text.substring(0, 200) + '...' : null
    };
  }

  // Результаты из БД
  if (documentInfo && documentInfo.ocrProcessed && documentInfo.ocrData) {
    const ocrData = documentInfo.ocrData as any;
    return {
      textPreview: ocrData.textPreview,
      textLength: ocrData.textLength,
      confidence: documentInfo.ocrConfidence,
      processedAt: ocrData.processedAt
    };
  }

  return null;
}

/**
 * Получение информации об ошибке (требование 4.3)
 */
function getErrorInfo(jobStatus: any, documentInfo: any) {
  // Приоритет ошибкам из задачи
  if (jobStatus && jobStatus.error) {
    return {
      message: jobStatus.error,
      code: 'QUEUE_ERROR',
      retryable: true,
      occurredAt: jobStatus.finishedAt
    };
  }

  // Ошибки из БД
  if (documentInfo && documentInfo.ocrData) {
    const ocrData = documentInfo.ocrData as any;
    if (ocrData.error) {
      return {
        message: ocrData.error,
        code: ocrData.errorCode || 'PROCESSING_ERROR',
        type: ocrData.errorType,
        retryable: ocrData.retryable || false,
        occurredAt: ocrData.processedAt
      };
    }
  }

  return null;
} 
