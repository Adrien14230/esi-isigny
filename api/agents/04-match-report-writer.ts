// AGENT 04 — Match Report Writer (LLM)
// Runs Monday 04:00, after agents 01-03. For each played match this week,
// generates a short post-match report using Claude Haiku and pushes it
// to the news feed.

import { ask } from '../../lib/claude';
import { db, logRun } from '../../lib/db';

export default async function handler() {
  try {
    // Get played matches without a report yet
    const { data: matches } = await db
      .from('matches')
      .select('*')
      .eq('has_report', false)
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString());

    let written = 0;
    for (const m of matches || []) {
      const score = m.esi_home
        ? `${m.recevant_buts}-${m.visiteur_buts}`
        : `${m.visiteur_buts}-${m.recevant_buts}`;
      const result = m.esi_home
        ? (m.recevant_buts > m.visiteur_buts ? 'victoire' : m.recevant_buts < m.visiteur_buts ? 'défaite' : 'nul')
        : (m.visiteur_buts > m.recevant_buts ? 'victoire' : m.visiteur_buts < m.recevant_buts ? 'défaite' : 'nul');

      const prompt = `Rédige un compte-rendu court (3-4 phrases, ton chaleureux mais factuel) pour le match suivant de l'Étoile Sportive d'Isigny :
- Équipe ESI : ${m.team_label}
- Adversaire : ${m.esi_home ? m.visiteur_nom : m.recevant_nom}
- Lieu : ${m.esi_home ? 'à domicile' : 'à l\'extérieur'}
- Score : ${score} (${result} pour l'ESI)
- Compétition : ${m.competition}

Format : un paragraphe direct, pas de titre, pas de listing. Style "club de village".`;

      const text = await ask(prompt, { maxTokens: 300 });
      await db.from('news').insert({
        kind: 'match_report', match_id: m.id, body: text,
        published_at: new Date().toISOString(),
      });
      await db.from('matches').update({ has_report: true }).eq('id', m.id);
      written++;
    }

    await logRun('04-match-report-writer', 'success', { reports: written });
    return Response.json({ ok: true, reports: written });
  } catch (err: any) {
    await logRun('04-match-report-writer', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const config = { schedule: '0 4 * * 1' };
