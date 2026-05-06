// AGENT 06 — Social Media Poster
// Runs Monday 09:00. Posts the weekend results to Instagram + Facebook
// using the official Meta Graph API. Builds a square image with score on the fly.

import { db, logRun } from '../../lib/db';
import { ask } from '../../lib/claude';

const META_PAGE_ID = process.env.META_PAGE_ID;
const META_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_BUSINESS_ACCOUNT_ID;

export default async function handler() {
  try {
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: matches } = await db
      .from('matches')
      .select('*')
      .eq('posted_to_social', false)
      .gte('date', since);

    let posted = 0;
    for (const m of matches || []) {
      const opp = m.esi_home ? m.visiteur_nom : m.recevant_nom;
      const score = m.esi_home
        ? `${m.recevant_buts}-${m.visiteur_buts}`
        : `${m.visiteur_buts}-${m.recevant_buts}`;
      const verdict = m.recevant_buts === m.visiteur_buts ? '🤝 NUL'
        : (m.esi_home === (m.recevant_buts > m.visiteur_buts) ? '✅ VICTOIRE' : '❌ DÉFAITE');

      const caption = await ask(
        `Génère un caption Instagram court (max 80 mots) pour le match ESI ${m.team_label} ${verdict} ${score} contre ${opp}. Style chaleureux, amateur, hashtags #ESIIsigny #FootAmateur #DistrictManche #Manche.`,
        { maxTokens: 220 }
      );

      const imageUrl = `https://esi-isigny.fr/og-image?match=${m.id}`; // Generated on the fly

      // Post to Facebook Page
      await fetch(`https://graph.facebook.com/v21.0/${META_PAGE_ID}/photos?access_token=${META_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl, caption }),
      });

      // Post to Instagram (2-step: container then publish)
      const containerRes = await fetch(`https://graph.facebook.com/v21.0/${IG_ACCOUNT_ID}/media?access_token=${META_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption }),
      });
      const { id: containerId } = await containerRes.json();
      await fetch(`https://graph.facebook.com/v21.0/${IG_ACCOUNT_ID}/media_publish?access_token=${META_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerId }),
      });

      await db.from('matches').update({ posted_to_social: true }).eq('id', m.id);
      posted++;
    }

    await logRun('06-social-poster', 'success', { posted });
    return Response.json({ ok: true, posted });
  } catch (err: any) {
    await logRun('06-social-poster', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const config = { schedule: '0 9 * * 1' };
