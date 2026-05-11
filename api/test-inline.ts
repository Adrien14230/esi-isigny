// Test self-contained — no imports at all
export const runtime = 'edge';

export default async function handler(req: Request) {
  const SB_URL = process.env.SUPABASE_URL || '';
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

  if (!SB_URL || !SB_KEY) {
    return Response.json({ ok: false, error: 'env missing' }, { status: 500 });
  }

  // Try to fetch from Supabase directly
  try {
    const res = await fetch(`${SB_URL}/rest/v1/matches?select=count&limit=1`, {
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'content-type': 'application/json',
      },
    });
    const status = res.status;
    const text = await res.text();
    return Response.json({ ok: true, status, body: text.slice(0, 200) });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
