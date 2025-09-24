import { NextResponse } from "next/server";
import { getCurrentUserFromSession } from "@/lib/auth-user";

export async function GET() {
  const { user, error } = await getCurrentUserFromSession();
  if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: Boolean(user.totpSecret) });
}
