// AGENT 01 — FFF Results Sync
// Runs every Monday at 02:00 (after weekend matches).
// Scrapes all played matches of the past week from FFF and writes them to DB.
// The site reads from DB at build/runtime → fresh data without manual edits.

import { fetchClubPage, parseMatches } from '../../lib/fff.js';
import { db, logRun } from '../../lib/db.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  try {
    const data = await fetchClubPage();
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7); // 2026-05
    const matches = parseMatches(data, monthKey);
    const played = matches.filter(m => m.status === 'joué');

    for (const m of played) {
      await db.from('matches').upsert({
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
      }, { onConflict: 'id' });
    }

    await logRun('01-fff-results-sync', 'success', { played_count: played.length });
    return Response.json({ ok: true, played: played.length });
  } catch (err: any) {
    await logRun('01-fff-results-sync', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

