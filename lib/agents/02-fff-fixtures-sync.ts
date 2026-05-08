// AGENT 02 — FFF Fixtures Sync
// Lundi 2h30. Scrape le calendrier futur (30 jours) → table fixtures.
import { fetchClubPage, parseMatches } from '../fff.js';
import { sbUpsert, logRun } from '../supabase.js';

export async function run() {
  try {
    const data = await fetchClubPage();
    const now = new Date();
    const m1 = now.toISOString().slice(0, 7);
    const next = new Date(now); next.setMonth(next.getMonth() + 1);
    const m2 = next.toISOString().slice(0, 7);

    const all = [...parseMatches(data, m1), ...parseMatches(data, m2)];
    const upcoming = all.filter(m => m.status === 'à venir');

    for (const m of upcoming) {
      await sbUpsert('fixtures', {
        id: m.id,
        date: m.date,
        competition: m.competition,
        category: m.category,
        pool: m.pool,
        team_label: m.esiTeamLabel,
        opponent: m.esiHome ? m.visiteur.nom : m.recevant.nom,
        opponent_logo: m.esiHome ? m.visiteur.logo : m.recevant.logo,
        venue: m.esiHome ? 'home' : 'away',
        synced_at: new Date().toISOString(),
      }, 'id');
    }

    await logRun('02-fff-fixtures-sync', 'success', { upcoming_count: upcoming.length });
    return { ok: true, fixtures: upcoming.length };
  } catch (err: any) {
    await logRun('02-fff-fixtures-sync', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
