// AGENT 09 — Club Stats Aggregator
// Lundi 5h. Crunche tous les résultats pour produire les stats hebdo + saison
// par équipe et au niveau club. Utilisé par le hero info-band et le chatbot.
import { sbSelect, sbUpsert, logRun } from '../supabase.js';

export async function run() {
  try {
    const since = new Date('2025-08-01').toISOString();
    const matches = await sbSelect<any>('matches', `select=*&date=gte.${encodeURIComponent(since)}`);

    const byTeam: Record<string, any> = {};
    for (const m of matches) {
      const t = m.team_label;
      const esiButs = m.esi_home ? m.recevant_buts : m.visiteur_buts;
      const oppButs = m.esi_home ? m.visiteur_buts : m.recevant_buts;
      byTeam[t] ||= { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
      byTeam[t].played++;
      byTeam[t].gf += esiButs || 0;
      byTeam[t].ga += oppButs || 0;
      if (esiButs > oppButs) byTeam[t].wins++;
      else if (esiButs === oppButs) byTeam[t].draws++;
      else byTeam[t].losses++;
    }

    const clubTotals = Object.values(byTeam).reduce((acc: any, t: any) => ({
      played: acc.played + t.played,
      wins: acc.wins + t.wins,
      draws: acc.draws + t.draws,
      losses: acc.losses + t.losses,
      gf: acc.gf + t.gf,
      ga: acc.ga + t.ga,
    }), { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 });

    await sbUpsert('club_stats', {
      id: 1,
      season: '2025-26',
      per_team: byTeam,
      club_totals: clubTotals,
      updated_at: new Date().toISOString(),
    }, 'id');

    await logRun('09-stats-aggregator', 'success', { teams: Object.keys(byTeam).length });
    return { ok: true, teams: Object.keys(byTeam).length };
  } catch (err: any) {
    await logRun('09-stats-aggregator', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
