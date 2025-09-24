// Deprecated: this route is intentionally disabled after migrating to NextAuth sessions.
export const runtime = "nodejs";
export async function POST() {
	return new Response(JSON.stringify({ error: "vkid_session_route_removed" }), { status: 410, headers: { "content-type": "application/json" } });
}

