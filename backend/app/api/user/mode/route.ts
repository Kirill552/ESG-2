import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";

const logger = new Logger("user-mode");

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

    // Находим пользователя в базе
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        mode: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Пользователь не найден в базе данных.",
        },
        { status: 404 }
      );
    }

    logger.info("User mode retrieved", {
      userId: user.id,
      mode: user.mode,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mode: user.mode,
      },
    });
  } catch (error) {
    logger.error(
      "Failed to retrieve user mode",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить информацию о режиме пользователя.",
      },
      { status: 500 }
    );
  }
}