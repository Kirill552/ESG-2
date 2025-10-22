/**
 * PUT /api/admin/organizations/[id]/access — управление доступами и лимитами организации
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const AccessUpdateSchema = z.object({
  // Флаги доступа к функциям
  canUploadDocuments: z.boolean().optional(),
  canUseOCR: z.boolean().optional(),
  canGenerate296FZ: z.boolean().optional(),
  canGenerateCBAM: z.boolean().optional(),
  canExportData: z.boolean().optional(),
  canUseAnalytics: z.boolean().optional(),

  // Численные лимиты (0 = без ограничений)
  documentsPerMonth: z.number().int().min(0).optional(),
  reportsPerMonth: z.number().int().min(0).optional(),
  ocrPagesPerMonth: z.number().int().min(0).optional(),
  storageQuotaMB: z.number().int().min(0).optional(),
  usersPerOrg: z.number().int().min(0).optional(),

  // Темпоральные ограничения
  accessExpiresAt: z.string().datetime().optional().nullable(),
  autoExtendTrial: z.boolean().optional(),
});

async function putHandler(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const organizationId = params.id;
    const admin = context.admin;

    const body = await request.json();
    const accessData = AccessUpdateSchema.parse(body);

    // Проверяем существование организации
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        userId: true,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
    }

    // Подготавливаем данные для обновления
    const updateData: any = {};

    // Флаги доступа
    if (accessData.canUploadDocuments !== undefined) updateData.canUploadDocuments = accessData.canUploadDocuments;
    if (accessData.canUseOCR !== undefined) updateData.canUseOCR = accessData.canUseOCR;
    if (accessData.canGenerate296FZ !== undefined) updateData.canGenerate296FZ = accessData.canGenerate296FZ;
    if (accessData.canGenerateCBAM !== undefined) updateData.canGenerateCBAM = accessData.canGenerateCBAM;
    if (accessData.canExportData !== undefined) updateData.canExportData = accessData.canExportData;
    if (accessData.canUseAnalytics !== undefined) updateData.canUseAnalytics = accessData.canUseAnalytics;

    // Лимиты
    if (accessData.documentsPerMonth !== undefined) updateData.documentsPerMonth = accessData.documentsPerMonth;
    if (accessData.reportsPerMonth !== undefined) updateData.reportsPerMonth = accessData.reportsPerMonth;
    if (accessData.ocrPagesPerMonth !== undefined) updateData.ocrPagesPerMonth = accessData.ocrPagesPerMonth;
    if (accessData.storageQuotaMB !== undefined) updateData.storageQuotaMB = accessData.storageQuotaMB;
    if (accessData.usersPerOrg !== undefined) updateData.usersPerOrg = accessData.usersPerOrg;

    // Темпоральные ограничения
    if (accessData.accessExpiresAt !== undefined) {
      updateData.accessExpiresAt = accessData.accessExpiresAt ? new Date(accessData.accessExpiresAt) : null;
    }
    if (accessData.autoExtendTrial !== undefined) updateData.autoExtendTrial = accessData.autoExtendTrial;

    // Обновляем организацию
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Логируем изменение доступов
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: admin.id,
        type: 'organization_access_updated',
        severity: 'INFO',
        message: `Администратор ${admin.email} изменил доступы организации ${organization.name}`,
        metadata: {
          organizationId,
          organizationName: organization.name,
          changes: accessData,
        },
      },
    });

    // Создаем audit log
    await prisma.auditLog.create({
      data: {
        userId: organization.userId,
        organizationId,
        action: 'organization_access_updated',
        resourceType: 'organization',
        resourceId: organizationId,
        details: JSON.stringify({
          changes: accessData,
          updatedBy: admin.email,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    console.log(`✅ [Organization Access] Updated access for ${organization.name} by ${admin.email}`);

    return NextResponse.json({
      success: true,
      message: 'Доступы организации успешно обновлены',
      organization: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Organization Access] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении доступов организации' },
      { status: 500 }
    );
  }
}

export const PUT = withAdminAuth(putHandler);
