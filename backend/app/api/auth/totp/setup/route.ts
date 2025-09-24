import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import { getCurrentUserFromSession } from "@/lib/auth-user";

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await getCurrentUserFromSession();
    if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    if (user.totpSecret) {
      return NextResponse.json({ error: "totp_already_enabled" }, { status: 400 });
    }

    const secret = authenticator.generateSecret();
    const label = encodeURIComponent(user.email || "user");
    const issuer = encodeURIComponent("ESG-Lite");
    const otpauth = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    return NextResponse.json({ secret, otpauth });
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
