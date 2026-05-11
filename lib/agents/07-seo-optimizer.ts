// AGENT 07 — SEO Optimizer
// Dimanche 23h. Refresh la meta description (Claude) et JSON-LD events depuis fixtures.
// Le sitemap.xml est statique sur Vercel — la lastmod date est mise à jour ici via DB,
// le sitemap dynamique sera servi par /api/sitemap si on l'ajoute plus tard.
// Skip si ANTHROPIC_API_KEY manque.
import { sbSelect, sbUpsert, logRun } from '../supabase';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

async function askClaude(prompt: string, maxTokens = 200): Promise<string> {
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
    const fixtures = await sbSelect<any>('fixtures', 'select=*&order=date.asc&limit=8');
    const lastResults = await sbSelect<any>('matches', 'select=*&order=date.desc&limit=1');
    const last = lastResults[0];

    let metaDesc = '';
    if (ANTHROPIC_KEY && last) {
      metaDesc = await askClaude(
        `Réécris la meta description (155 chars max) du site etoile-sportive-isigny.fr en intégrant le dernier résultat (${last.team_label} ${last.recevant_buts}-${last.visiteur_buts} ${last.visiteur_nom}). Garde "Étoile Sportive d'Isigny", "1925", "District Manche".`
      );
    } else {
      metaDesc = "Étoile Sportive d'Isigny — Club de football amateur depuis 1925, District Manche. 9 équipes engagées · Calendrier, résultats, classements en direct.";
    }

    const events = fixtures.map(f => ({
      '@type': 'SportsEvent',
      name: `${f.team_label} vs ${f.opponent}`,
      startDate: f.date,
      sport: 'Football',
      location: {
        '@type': 'Place',
        name: f.venue === 'home' ? "Stade Municipal d'Isigny" : f.opponent,
      },
    }));

    const today = new Date().toISOString().slice(0, 10);
    await sbUpsert('seo_state', {
      id: 1,
      meta_description: metaDesc,
      events_jsonld: events,
      sitemap_lastmod: today,
      updated_at: new Date().toISOString(),
    }, 'id');

    await logRun('07-seo-optimizer', 'success', { events: events.length, meta_len: metaDesc.length });
    return { ok: true, events: events.length };
  } catch (err: any) {
    await logRun('07-seo-optimizer', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
