// Centralized NextAuth options (no NextAuth call here!)
// Tests can import/mock from '@/lib/auth-options' safely without executing route handler code.
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

// VK ID Provider
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
	profile(profile: any) {
		return {
			id: String(profile?.sub || profile?.id || ""),
			email: profile?.email || null,
			name: [profile?.given_name, profile?.family_name].filter(Boolean).join(" ") || profile?.name || null,
		} as any;
	},
} as any;

// SberID Provider
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
	profile(profile: any) {
		return {
			id: String(profile?.sub || profile?.id || ""),
			email: profile?.email || null,
			name: profile?.name || [profile?.given_name, profile?.family_name].filter(Boolean).join(" ") || null,
			phone: profile?.phone_number || null,
		} as any;
	},
} as any;

export const authOptions = {
	adapter: PrismaAdapter(prisma as any),
	providers: [
		CredentialsProvider({
			id: "credentials",
			name: "Пароль",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Пароль", type: "password" }
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					console.log('[DEBUG] Missing credentials');
					return null;
				}

				try {
					console.log('[DEBUG] Credentials provider - email:', credentials.email);
					console.log('[DEBUG] Credentials provider - password length:', credentials.password.length);
          
					const user = await (prisma as any).user.findUnique({
						where: { email: credentials.email },
						select: { 
							id: true, 
							email: true, 
							name: true, 
							hashedPassword: true 
						}
					});

					if (!user) {
						console.log('[DEBUG] User not found');
						return null;
					}

					if (!user.hashedPassword) {
						console.log('[DEBUG] User has no password');
						return null;
					}

					console.log('[DEBUG] User found:', user.email);
					console.log('[DEBUG] Stored hash starts with:', user.hashedPassword.substring(0, 10));

					const isPasswordValid = await bcrypt.compare(credentials.password, user.hashedPassword);
          
					console.log('[DEBUG] Password comparison result:', isPasswordValid);
          
					if (!isPasswordValid) {
						console.log('[DEBUG] Invalid password');
						return null;
					}

					console.log('[DEBUG] Password login successful for:', user.email);
					return {
						id: user.id,
						email: user.email,
						name: user.name,
					};
				} catch (error) {
					console.error('[DEBUG] Error in credentials provider:', error);
					return null;
				}
			}
		}),
		VKIDProvider,
		SberIDProvider,
	],
	session: { 
		strategy: "database" as const,
		maxAge: 30 * 24 * 60 * 60,
		updateAge: 24 * 60 * 60,
	},
	cookies: {
		sessionToken: {
			name: process.env.NODE_ENV === 'production' 
				? "__Secure-next-auth.session-token" 
				: "next-auth.session-token",
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: process.env.NODE_ENV === 'production',
				maxAge: 30 * 24 * 60 * 60,
			}
		}
	},
	secret: process.env.AUTH_SECRET,
	pages: {
		signIn: '/sign-in',
		error: '/sign-in',
	},
	callbacks: {
		async jwt({ token, user, account }: any) {
			if (user) {
				token.id = user.id;
				token.email = user.email;
				token.name = user.name;
			}
			return token;
		},
		async session({ session, token, user }: any) {
			try {
				if (session?.user) {
					if (user?.id) {
						(session as any).userId = user.id;
						(session.user as any).id = user.id;
					} else if (token?.id) {
						(session as any).userId = token.id;
						(session.user as any).id = token.id;
					} else if (session.user.email) {
						const dbUser = await (prisma as any).user.findUnique({
							where: { email: session.user.email },
							select: { id: true }
						});
						if (dbUser?.id) {
							(session as any).userId = dbUser.id;
							(session.user as any).id = dbUser.id;
						}
					}
					if (typeof session.user.email === 'undefined' && token?.email) {
						session.user.email = token.email;
					}
					if (typeof session.user.name === 'undefined' && token?.name) {
						session.user.name = token.name;
					}
				}
			} catch (e) {
				// swallow
			}
			return session;
		},
		async signIn({ user, account }: any) {
			console.log('[DEBUG] signIn callback called with:', { 
				user: user ? { id: user.id, email: user.email } : null, 
				account: account ? { provider: account.provider, type: account.type } : null 
			});
      
			if (account?.provider === 'credentials' && user) {
				try {
					const existingUser = await (prisma as any).user.findUnique({
						where: { id: user.id }
					});
					console.log('[DEBUG] Existing user found:', !!existingUser);
					return !!existingUser;
				} catch (error) {
					console.error('[DEBUG] Error checking user in signIn:', error);
					return false;
				}
			}
      
			return true;
		},
		async redirect({ url, baseUrl }: any) {
			console.log('[DEBUG] Redirect callback:', { url, baseUrl });
      
			if (url === `${baseUrl}/sign-in` || url.includes('/sign-in')) {
				console.log('[DEBUG] Redirecting credentials login to dashboard');
				return `${baseUrl}/dashboard`;
			}
      
			if (url.startsWith("/")) return `${baseUrl}${url}`;
			else if (new URL(url).origin === baseUrl) return url;
			return baseUrl;
		},
	},
	events: {
		async signIn({ user, account }: any) {
			console.log(`User ${user.email} signed in with ${account?.provider}`);
		},
		async signOut({ session }: any) {
			console.log(`User signed out`);
			if (session?.userId) {
				console.log(`Clearing session for user ${session.userId}`);
			}
		},
	},
};

