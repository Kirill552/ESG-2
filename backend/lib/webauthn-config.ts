const FALLBACK_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_BASE_URL ||
  process.env.APP_URL ||
  "http://localhost:3000";

const resolveOrigin = () => {
  const configured = process.env.WEBAUTHN_EXPECTED_ORIGIN || FALLBACK_APP_URL;
  try {
    const url = new URL(configured);
    return url.origin;
  } catch (error) {
    console.warn("[WebAuthn] Invalid origin configuration", { configured, error });
    return "http://localhost:3000";
  }
};

export const WEBAUTHN_EXPECTED_ORIGIN = resolveOrigin();

export const WEBAUTHN_RP_ID = (() => {
  const configured = process.env.WEBAUTHN_RP_ID;
  if (configured) {
    return configured;
  }
  try {
    const url = new URL(WEBAUTHN_EXPECTED_ORIGIN);
    return url.hostname;
  } catch (error) {
    console.warn("[WebAuthn] Unable to derive RP ID from origin", { error });
    return "localhost";
  }
})();

export const WEBAUTHN_RP_NAME = process.env.WEBAUTHN_RP_NAME || "ESG-Lite";

export const PASSKEY_CHALLENGE_TTL_SECONDS = Number(process.env.WEBAUTHN_CHALLENGE_TTL_SECONDS || 600);

export const PASSKEY_TIMEOUT_MS = Number(process.env.WEBAUTHN_TIMEOUT_MS || 60000);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const getRequestIp = (headers: Headers) => {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",");
    if (parts.length > 0) {
      return parts[0]?.trim();
    }
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return undefined;
};
