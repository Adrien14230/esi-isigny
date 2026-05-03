// AGENT 02 — FFF Fixtures Sync
// Runs every Monday at 02:30. Pulls upcoming fixtures (next 30 days)
// for all 9 ESI teams from FFF, writes to DB. Powers the calendar section.

import { fetchClubPage, parseMatches } from '../../lib/fff';
import { db, logRun } from '../../lib/db';

export default async function handler() {
  try {
    const data = await fetchClubPage();
    const now = new Date();
    const m1 = now.toISOString().slice(0, 7);
    const next = new Date(now); next.setMonth(next.getMonth() + 1);
    const m2 = next.toISOString().slice(0, 7);

    const all = [...parseMatches(data, m1), ...parseMatches(data, m2)];
    const upcoming = all.filter(m => m.status === 'à venir');

    for (const m of upcoming) {
      await db.from('fixtures').upsert({
        id: m.id, date: m.date, competition: m.competition,
        category: m.category, pool: m.pool, team_label: m.esiTeamLabel,
        opponent: m.esiHome ? m.visiteur.nom : m.recevant.nom,
        opponent_logo: m.esiHome ? m.visiteur.logo : m.recevant.logo,
        venue: m.esiHome ? 'home' : 'away',
        synced_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }

    await logRun('02-fff-fixtures-sync', 'success', { upcoming_count: upcoming.length });
    return Response.json({ ok: true, fixtures: upcoming.length });
  } catch (err: any) {
    await logRun('02-fff-fixtures-sync', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const config = { schedule: '30 2 * * 1' };
