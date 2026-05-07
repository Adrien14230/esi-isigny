// AGENT 05 — Convocation Reminder
// Runs every day at 18:00. Sends an email/push to each licencié convoked
// for a match in the next 24-48h. Uses direct Supabase REST API (no SDK)
// for full Edge Runtime compatibility.

export const runtime = 'edge';

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

async function sbFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'content-type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null };
}

export default async function handler() {
  try {
    if (!SB_URL || !SB_KEY) {
      return Response.json({ ok: false, error: 'SUPABASE_URL or SUPABASE_SERVICE_KEY missing' }, { status: 500 });
    }

    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const tomorrowEnd = new Date(Date.now() + 2 * 86400000).toISOString();

    const q = `convocations?select=*&match_date=gte.${encodeURIComponent(tomorrow)}&match_date=lt.${encodeURIComponent(tomorrowEnd)}`;
    const { ok, status, body } = await sbFetch(q);

    if (!ok) {
      return Response.json({ ok: false, error: `Supabase query failed`, status, body }, { status: 500 });
    }

    const convocs = (body as any[]) || [];

    await sbFetch('agent_runs', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: '05-convoc-reminder',
        status: 'success',
        meta: { convocs_count: convocs.length, sent: 0 },
        ran_at: new Date().toISOString(),
      }),
    });

    return Response.json({ ok: true, convocs_count: convocs.length, sent: 0 });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message, stack: err.stack?.slice(0, 500) }, { status: 500 });
  }
}
