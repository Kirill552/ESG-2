// Centralized NextAuth options (no NextAuth call here!)
// Tests can import/mock from '@/lib/auth-options' safely without executing route handler code.
import type { AuthOptions, User } from "next-auth";
import type { OAuthConfig } from "next-auth/providers";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

type OpenIDProfile = {
	sub?: string;
	id?: string;
	email?: string;
	given_name?: string;
	family_name?: string;
	name?: string;
	phone_number?: string;
};

const buildDisplayName = (profile: OpenIDProfile) => {
	const parts = [profile?.given_name, profile?.family_name].filter(Boolean) as string[];
	if (parts.length) {
		return parts.join(" ");
	}
	return profile?.name ?? null;
};

const toIsoString = (value?: string | Date | null) => {
	if (!value) return undefined;
	if (typeof value === "string") return value;
	return value.toISOString();
};

type OIDCProviderConfig = OAuthConfig<OpenIDProfile> & { idToken?: boolean };

const VKIDProvider = {
	id: "vkid",
	name: "VK ID",
	type: "oauth",
	wellKnown: "https://id.vk.com/.well-known/openid-configuration",
	authorization: { params: { scope: "openid email phone" } },
	checks: ["pkce", "state"],
	clientId: process.env.VKID_CLIENT_ID || process.env.NEXT_PUBLIC_VKID_APP_ID,
	clientSecret: process.env.VKID_CLIENT_SECRET || "unused",
	idToken: true,
	profile(profile) {
		return {
			id: String(profile?.sub ?? profile?.id ?? ""),
			email: profile?.email ?? null,
			name: buildDisplayName(profile),
			phone: profile?.phone_number ?? null,
		};
	},
} satisfies OIDCProviderConfig;

const SberIDProvider = {
	id: "sberid",
	name: "Сбер ID",
	type: "oauth",
	wellKnown: "https://auth.sber.ru/.well-known/openid_configuration",
	authorization: { params: { scope: "openid email profile phone" } },
	checks: ["pkce", "state"],
	clientId: process.env.SBERID_CLIENT_ID,
	clientSecret: process.env.SBERID_CLIENT_SECRET,
	idToken: true,
	profile(profile) {
		return {
			id: String(profile?.sub ?? profile?.id ?? ""),
			email: profile?.email ?? null,
			name: buildDisplayName(profile),
			phone: profile?.phone_number ?? null,
		};
	},
} satisfies OIDCProviderConfig;

const isProduction = process.env.NODE_ENV === "production";

const oauthProviders: AuthOptions["providers"] = [];

if (VKIDProvider.clientId) {
	oauthProviders.push(VKIDProvider);
}

if (SberIDProvider.clientId && SberIDProvider.clientSecret) {
	oauthProviders.push(SberIDProvider);
}

export const authOptions: AuthOptions = {
	adapter: PrismaAdapter(prisma),
	providers: [
		CredentialsProvider({
			id: "credentials",
			name: "Пароль",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Пароль", type: "password" },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					return null;
				}

				try {
					const user = await prisma.user.findUnique({
						where: { email: credentials.email },
						select: {
							id: true,
							email: true,
							name: true,
							hashedPassword: true,
							lastLoginAt: true,
							isBlocked: true,
						},
					});

					if (!user?.hashedPassword) {
						return null;
					}

					if (user.isBlocked) {
						return null;
					}

					const isPasswordValid = await bcrypt.compare(credentials.password, user.hashedPassword);

					if (!isPasswordValid) {
						return null;
					}

					const result: User & { lastLoginAt?: string } = {
						id: user.id,
						email: user.email,
						name: user.name ?? undefined,
						lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : undefined,
					};

					return result;
				} catch (error) {
					console.error("[AUTH] Error in credentials provider", error);
					return null;
				}
			},
		}),
		...oauthProviders,
	],
	session: {
		strategy: "database",
		maxAge: 30 * 24 * 60 * 60,
		updateAge: 24 * 60 * 60,
	},
	cookies: {
		sessionToken: {
			name: isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token",
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: isProduction,
				maxAge: 30 * 24 * 60 * 60,
			},
		},
	},
	secret: process.env.AUTH_SECRET,
	pages: {
		signIn: "/sign-in",
		error: "/sign-in",
	},
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				token.email = user.email;
				token.name = user.name;
				const lastLoginAt = toIsoString((user as any)?.lastLoginAt ?? null);
				if (lastLoginAt) {
					token.lastLoginAt = lastLoginAt;
				} else if (!token.lastLoginAt) {
					token.lastLoginAt = new Date().toISOString();
				}
			}
			return token;
		},
		async session({ session, token, user }) {
			try {
				if (session?.user) {
					const resolvedId = (user as any)?.id ?? (token?.id as string | undefined);
					if (resolvedId) {
						(session.user as any).id = resolvedId;
						(session as any).userId = resolvedId;
					}
					if (!session.user.email && token?.email) {
						session.user.email = token.email as string;
					}
					if (!session.user.name && token?.name) {
						session.user.name = token.name as string;
					}
					const lastLoginAt = toIsoString((user as any)?.lastLoginAt ?? (token as any)?.lastLoginAt ?? null);
					if (lastLoginAt) {
						(session.user as any).lastLoginAt = lastLoginAt;
					}
				}
			} catch (error) {
				console.error("[AUTH] Session callback error", error);
			}
			return session;
		},
		async signIn({ user, account }) {
			if (!user) {
				return false;
			}

			try {
				const existingUser = await prisma.user.findUnique({
					where: { id: user.id },
					select: { id: true, isBlocked: true },
				});

				if (!existingUser || existingUser.isBlocked) {
					return false;
				}

				const now = new Date();
				await prisma.user.update({
					where: { id: user.id },
					data: { lastLoginAt: now },
				});

				(user as any).lastLoginAt = now.toISOString();
			} catch (error) {
				console.error("[AUTH] signIn callback error", error);
				return false;
			}

			return true;
		},
		async redirect({ url, baseUrl }) {
			const postLoginPath =
				process.env.POST_LOGIN_PATH ||
				process.env.MAGIC_LINK_DEFAULT_REDIRECT ||
				"/?view=dashboard";
			const normalizedPostLoginPath = postLoginPath.startsWith("/")
				? postLoginPath
				: `/${postLoginPath}`;

			if (url === `${baseUrl}/sign-in` || url.includes("/sign-in")) {
				return `${baseUrl}${normalizedPostLoginPath}`;
			}

			if (url.startsWith("/")) return `${baseUrl}${url}`;
			if (new URL(url).origin === baseUrl) return url;
			return `${baseUrl}${normalizedPostLoginPath}`;
		},
	},
	events: {
		async signIn({ user, account }) {
			console.info(`User ${user?.email ?? user?.id} signed in with ${account?.provider}`);
		},
		async signOut({ session }) {
			const identifier =
				session?.user?.email ||
				session?.user?.name ||
				(session as unknown as { userId?: string })?.userId;
			if (identifier) {
				console.info(`Session closed for user ${identifier}`);
			}
		},
	},
};

