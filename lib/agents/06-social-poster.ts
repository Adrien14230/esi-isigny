// AGENT 06 — Social Media Poster
// Lundi 9h. Poste les résultats du weekend sur Instagram + Facebook via Meta Graph API.
// Skip si META tokens ou ANTHROPIC_API_KEY manquent.
import { sbSelect, sbUpdate, logRun } from '../supabase';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const META_PAGE_ID = process.env.META_PAGE_ID || '';
const META_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || '';
const IG_ACCOUNT_ID = process.env.IG_BUSINESS_ACCOUNT_ID || '';

async function askClaude(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const j = await res.json();
  return j.content?.[0]?.text || '';
}

export async function run() {
  try {
    if (!META_PAGE_ID || !META_ACCESS_TOKEN || !IG_ACCOUNT_ID || !ANTHROPIC_KEY) {
      await logRun('06-social-poster', 'success', { skipped: 'META or ANTHROPIC keys missing' });
      return { ok: true, skipped: 'META_PAGE_ID, META_PAGE_ACCESS_TOKEN, IG_BUSINESS_ACCOUNT_ID or ANTHROPIC_API_KEY missing' };
    }

    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const matches = await sbSelect<any>('matches', `select=*&posted_to_social=eq.false&date=gte.${encodeURIComponent(since)}`);

    let posted = 0;
    for (const m of matches) {
      const opp = m.esi_home ? m.visiteur_nom : m.recevant_nom;
      const score = m.esi_home ? `${m.recevant_buts}-${m.visiteur_buts}` : `${m.visiteur_buts}-${m.recevant_buts}`;
      const verdict = m.recevant_buts === m.visiteur_buts
        ? '🤝 NUL'
        : (m.esi_home === (m.recevant_buts > m.visiteur_buts) ? '✅ VICTOIRE' : '❌ DÉFAITE');

      const caption = await askClaude(
        `Génère un caption Instagram court (max 80 mots) pour le match ESI ${m.team_label} ${verdict} ${score} contre ${opp}. Style chaleureux, amateur, hashtags #ESIIsigny #FootAmateur #DistrictManche #Manche.`
      );

      const imageUrl = `https://etoile-sportive-isigny.fr/og-image?match=${m.id}`;

      // Post to Facebook
      await fetch(`https://graph.facebook.com/v21.0/${META_PAGE_ID}/photos?access_token=${META_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: imageUrl, caption }),
      });

      // Post to Instagram (2-step)
      const containerRes = await fetch(`https://graph.facebook.com/v21.0/${IG_ACCOUNT_ID}/media?access_token=${META_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption }),
      });
      const { id: containerId } = await containerRes.json();
      if (containerId) {
        await fetch(`https://graph.facebook.com/v21.0/${IG_ACCOUNT_ID}/media_publish?access_token=${META_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ creation_id: containerId }),
        });
      }

      await sbUpdate('matches', `id=eq.${m.id}`, { posted_to_social: true });
      posted++;
    }

    await logRun('06-social-poster', 'success', { posted });
    return { ok: true, posted };
  } catch (err: any) {
    await logRun('06-social-poster', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
