import { userFromToken, tokenFor } from "@/lib/local/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await userFromToken(url.searchParams.get("token") ?? "", "magic");
  if (!user) return new Response("This sign-in link is invalid or expired.", { status: 401 });
  const accessToken = await tokenFor(user);
  const session = JSON.stringify({ access_token: accessToken, expires_at: Math.floor(Date.now() / 1000) + 7 * 86400, user }).replace(/</g, "\\u003c");
  const next = JSON.stringify(url.searchParams.get("next") || "/");
  return new Response(`<!doctype html><meta charset="utf-8"><script>localStorage.setItem("plan-a-track-session",JSON.stringify(${session}));location.replace(${next});</script>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
