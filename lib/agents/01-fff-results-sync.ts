// AGENT 01 — FFF Results Sync
// Lundi 2h. Scrape les résultats des matchs joués → table matches.
import { fetchClubPage, parseMatches } from '../fff.js';
import { sbUpsert, logRun } from '../supabase.js';

export async function run() {
  try {
    const data = await fetchClubPage();
    const monthKey = new Date().toISOString().slice(0, 7);
    const matches = parseMatches(data, monthKey);
    const played = matches.filter(m => m.status === 'joué');

    for (const m of played) {
      await sbUpsert('matches', {
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
      }, 'id');
    }

    await logRun('01-fff-results-sync', 'success', { played_count: played.length });
    return { ok: true, played: played.length };
  } catch (err: any) {
    await logRun('01-fff-results-sync', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
