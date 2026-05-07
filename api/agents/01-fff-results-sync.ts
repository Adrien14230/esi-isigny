// AGENT 01 — FFF Results Sync
// Runs every Monday at 02:00. Scrapes played matches from FFF and writes them to DB.
// Uses direct Supabase REST API for full Edge Runtime compatibility.

import { fetchClubPage, parseMatches } from '../../lib/fff.js';

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
      Prefer: 'return=representation,resolution=merge-duplicates',
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

    const data = await fetchClubPage();
    const monthKey = new Date().toISOString().slice(0, 7);
    const matches = parseMatches(data, monthKey);
    const played = matches.filter(m => m.status === 'joué');

    for (const m of played) {
      await sbFetch('matches', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: m.id,
          date: m.date,
          status: m.status,
          competition: m.competition,
          category: m.category,
          team_label: m.esiTeamLabel,
          recevant_nom: m.recevant.nom,
          recevant_buts: m.recevant.buts,
          visiteur_nom: m.visiteur.nom,
          visiteur_buts: m.visiteur.buts,
          esi_home: m.esiHome,
          synced_at: new Date().toISOString(),
        }),
      });
    }

    await sbFetch('agent_runs', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: '01-fff-results-sync',
        status: 'success',
        meta: { played_count: played.length },
        ran_at: new Date().toISOString(),
      }),
    });

    return Response.json({ ok: true, played: played.length });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message, stack: err.stack?.slice(0, 500) }, { status: 500 });
  }
}
