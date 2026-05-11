// Minimal test endpoint to verify /api/run is reachable at all.
export const runtime = 'edge';

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || 'none';
  return new Response(JSON.stringify({ ok: true, id, ts: Date.now() }), {
    headers: { 'content-type': 'application/json' },
  });
}
