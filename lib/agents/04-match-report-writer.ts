// AGENT 04 — Match Report Writer (LLM)
// Lundi 4h. Pour chaque match joué cette semaine, génère un compte-rendu via Claude.
// Skip si ANTHROPIC_API_KEY manque.
import { sbSelect, sbInsert, sbUpdate, logRun } from '../supabase.js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

async function askClaude(prompt: string, maxTokens = 300): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const j = await res.json();
  return j.content?.[0]?.text || '';
}

export async function run() {
  try {
    if (!ANTHROPIC_KEY) {
      await logRun('04-match-report-writer', 'success', { skipped: 'ANTHROPIC_API_KEY missing' });
      return { ok: true, skipped: 'ANTHROPIC_API_KEY missing' };
    }

    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const matches = await sbSelect<any>('matches', `select=*&has_report=eq.false&date=gte.${encodeURIComponent(since)}`);

    let written = 0;
    for (const m of matches) {
      const score = m.esi_home ? `${m.recevant_buts}-${m.visiteur_buts}` : `${m.visiteur_buts}-${m.recevant_buts}`;
      const result = m.esi_home
        ? (m.recevant_buts > m.visiteur_buts ? 'victoire' : m.recevant_buts < m.visiteur_buts ? 'défaite' : 'nul')
        : (m.visiteur_buts > m.recevant_buts ? 'victoire' : m.visiteur_buts < m.recevant_buts ? 'défaite' : 'nul');

      const prompt = `Rédige un compte-rendu court (3-4 phrases, ton chaleureux mais factuel) pour le match suivant de l'Étoile Sportive d'Isigny :
- Équipe ESI : ${m.team_label}
- Adversaire : ${m.esi_home ? m.visiteur_nom : m.recevant_nom}
- Lieu : ${m.esi_home ? 'à domicile' : "à l'extérieur"}
- Score : ${score} (${result} pour l'ESI)
- Compétition : ${m.competition}

Format : un paragraphe direct, pas de titre, pas de listing. Style "club de village".`;

      const text = await askClaude(prompt, 300);
      await sbInsert('news', {
        kind: 'match_report',
        match_id: m.id,
        body: text,
        published_at: new Date().toISOString(),
      });
      await sbUpdate('matches', `id=eq.${m.id}`, { has_report: true });
      written++;
    }

    await logRun('04-match-report-writer', 'success', { reports: written });
    return { ok: true, reports: written };
  } catch (err: any) {
    await logRun('04-match-report-writer', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
