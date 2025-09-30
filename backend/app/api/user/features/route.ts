import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCurrentUserMode, isFeatureAvailable, getUserLimits } from "@/lib/user-mode-utils";
import { Logger } from "@/lib/logger";

const logger = new Logger("user-features");

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  try {
    if (!session?.user?.email) {
      return NextResponse.json(
        {
          ok: false,
          message: "Пользователь не авторизован.",
        },
        { status: 401 }
      );
    }

    // Получаем режим пользователя
    const userMode = await getCurrentUserMode();

    if (!userMode) {
      return NextResponse.json(
        {
          ok: false,
          message: "Не удалось определить режим пользователя.",
        },
        { status: 500 }
      );
    }

    // Проверяем доступные функции
    const features = {
      upload: await isFeatureAvailable('upload'),
      generateReports: await isFeatureAvailable('generate_reports'),
      analytics: await isFeatureAvailable('analytics'),
      export: await isFeatureAvailable('export')
    };

    // Получаем лимиты
    const limits = await getUserLimits();

    logger.info("User features requested", {
      email: session.user.email,
      mode: userMode,
      features,
      limits
    });

    return NextResponse.json({
      ok: true,
      mode: userMode,
      features,
      limits,
      isDemoMode: userMode === 'DEMO'
    });

  } catch (error) {
    logger.error(
      "Failed to get user features",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить информацию о доступных функциях.",
      },
      { status: 500 }
    );
  }
}