import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { issueNextAuthDatabaseSession } from "@/lib/nextauth-session";
import { fetchVKIDUserInfo } from "@/lib/vkid-service";
import prisma from "@/lib/prisma";
import jose from "node-jose";
import crypto from "crypto";

const TOKEN_URL = "https://id.vk.com/oauth2/token";
const ISSUER = "https://id.vk.com";
const OIDC_CONFIG_URL = `${ISSUER}/.well-known/openid-configuration`;

let jwksStore: jose.JWK.KeyStore | null = null;
let lastJwksFetch = 0;
const JWKS_TTL_MS = 60 * 60 * 1000; // 1h

async function getJwks(): Promise<jose.JWK.KeyStore> {
	const now = Date.now();
	if (jwksStore && now - lastJwksFetch < JWKS_TTL_MS) return jwksStore;
	const cfgRes = await fetch(OIDC_CONFIG_URL);
	if (!cfgRes.ok) throw new Error("oidc_discovery_failed");
	const cfg = (await cfgRes.json()) as { jwks_uri?: string };
	if (!cfg.jwks_uri) throw new Error("jwks_uri_missing");
	const jwksRes = await fetch(cfg.jwks_uri);
	if (!jwksRes.ok) throw new Error("jwks_fetch_failed");
	const jwksJson = await jwksRes.json();
	jwksStore = await jose.JWK.asKeyStore(jwksJson);
	lastJwksFetch = now;
	return jwksStore!;
}

async function verifyIdToken(idToken: string, clientId: string) {
	const keystore = await getJwks();
	const result = await jose.JWS.createVerify(keystore).verify(idToken).catch(() => null);
	if (!result) throw new Error("id_token_signature_invalid");
	const payload = JSON.parse(result.payload.toString());
	const { iss, aud, exp } = payload;
	if (iss !== ISSUER) throw new Error("id_token_iss_invalid");
	const audienceOk = Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
	if (!audienceOk) throw new Error("id_token_aud_invalid");
	if (typeof exp !== "number" || Date.now() / 1000 >= exp) throw new Error("id_token_expired");
	return payload as any;
}

export async function POST(req: NextRequest) {
		try {
		const { code, codeVerifier, redirectUrl, state } = (await req.json().catch(() => ({}))) as {
			code?: string;
			codeVerifier?: string;
			redirectUrl?: string;
			state?: string;
		};
		if (!code || !codeVerifier) {
			return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
		}

		// Validate state if provided
	const cookieStore = await cookies();
	const stateCookie = cookieStore.get?.("vkid_state")?.value;
		if (state && stateCookie && stateCookie !== state) {
			return NextResponse.json({ error: "invalid_state" }, { status: 400 });
		}

		const clientId = process.env.VKID_CLIENT_ID || process.env.NEXT_PUBLIC_VKID_APP_ID;
		// Handle VK ID redirect URL - VK console requires localhost without port
		let redirect_uri = redirectUrl || process.env.VKID_REDIRECT_URL;
		if (!redirect_uri) {
			const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
			const url = new URL(baseUrl);
			if (url.hostname === 'localhost') {
				redirect_uri = 'https://localhost/auth/vk/callback';
			} else {
				redirect_uri = `${baseUrl}/auth/vk/callback`;
			}
		}
		if (!clientId) {
			return NextResponse.json({ error: "missing_client_id" }, { status: 500 });
		}

		const form = new URLSearchParams();
		form.set("grant_type", "authorization_code");
		form.set("code", code);
		form.set("client_id", clientId);
		form.set("redirect_uri", redirect_uri);
		form.set("code_verifier", codeVerifier);

		const tokenRes = await fetch(TOKEN_URL, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: form.toString(),
		});
		if (!tokenRes.ok) {
			const text = await tokenRes.text();
			return NextResponse.json({ error: "token_exchange_failed", details: text }, { status: 400 });
		}
				const tokenData = (await tokenRes.json()) as Record<string, unknown>;

				// Валидация id_token по OIDC (подпись/iss/aud/exp)
				const id_token = (tokenData as any).id_token as string | undefined;
				let idTokenPayload: any = null;
				if (id_token) {
					try {
						idTokenPayload = await verifyIdToken(id_token, String(clientId));
					} catch (e) {
						return NextResponse.json({ error: "invalid_id_token" }, { status: 400 });
					}
				}

        // Получаем user info и создаём/находим пользователя
        const access_token = (tokenData as any).access_token as string | undefined;
				let userId: string | null = null;
			let vkProviderId: string | undefined;
        try {
            if (access_token) {
                const ui = await fetchVKIDUserInfo(access_token);
							vkProviderId = (ui as any)?.id || idTokenPayload?.sub || undefined;
                const email = (ui as any)?.email || undefined;
                const firstName = ui?.first_name || null;
                const lastName = ui?.last_name || null;
                // Линкуем по email при наличии, иначе создаём временную запись без email
                if (email) {
                        const user = await (prisma as any).user.upsert({
                        where: { email },
                        update: { firstName, lastName },
                        create: { email, firstName, lastName },
                    });
						userId = user.id;
										// Сохраняем аккаунт провайдера VK ID
										if (vkProviderId) {
											await (prisma as any).account.upsert({
												where: { provider_providerAccountId: { provider: "vkid", providerAccountId: vkProviderId } },
												update: { access_token },
												create: {
													userId: user.id,
													type: "oauth",
													provider: "vkid",
													providerAccountId: vkProviderId,
													access_token,
												},
											});
										}
                }
            }
        } catch {}

				// Если email отсутствует — создаём временный токен линковки и просим ввести email
				if (!userId) {
					const providerAccountId = vkProviderId || idTokenPayload?.sub;
					if (!providerAccountId) {
						return NextResponse.json({ error: "provider_id_missing" }, { status: 400 });
					}
					const linkToken = crypto.randomBytes(32).toString("base64url");
					const expires = new Date(Date.now() + 15 * 60 * 1000);
					await (prisma as any).verificationToken.create({
						data: { identifier: `vkid:${providerAccountId}`, token: linkToken, expires },
					});
					const resp = NextResponse.json({ needEmail: true, linkToken });
					resp.cookies.set("vkid_state", "", { path: "/", maxAge: 0 });
					return resp;
				}

				// Иначе — выдаём сессию NextAuth пользователю
				const resp = NextResponse.json({ ok: true });
				await issueNextAuthDatabaseSession(resp, userId);
				resp.cookies.set("vkid_state", "", { path: "/", maxAge: 0 });
				return resp;
	} catch (error) {
		return NextResponse.json({ error: "internal_error" }, { status: 500 });
	}
}


