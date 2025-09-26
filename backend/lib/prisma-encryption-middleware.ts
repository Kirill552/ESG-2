type PrismaMiddlewareParams = {
  model?: string;
  action: string;
  args: unknown;
  dataPath: string[];
  runInTransaction: boolean;
};

type PrismaMiddlewareNext = (
  params: PrismaMiddlewareParams,
) => Promise<unknown>;

type PrismaMiddleware = (
  params: PrismaMiddlewareParams,
  next: PrismaMiddlewareNext,
) => Promise<unknown>;

/**
 * Заглушка middleware для Prisma, чтобы не блокировать разработку.
 * TODO: заменить на реализацию с реальным шифрованием полей ПДн (152-ФЗ).
 */
export const encryptionMiddleware: PrismaMiddleware = async (params, next) => {
  // На данном этапе просто пробрасываем вызов без модификации данных.
  return next(params);
};
