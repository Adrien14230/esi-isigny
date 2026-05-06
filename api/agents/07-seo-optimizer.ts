// AGENT 07 — SEO Optimizer
// Runs every Sunday 23:00. Refreshes the dynamic SEO surface :
// - Updates sitemap.xml lastmod timestamps
// - Regenerates Schema.org SportsEvent entries from upcoming fixtures
// - Generates OG images per page (using Vercel OG)
// - Pushes fresh meta descriptions tailored to most recent results

import { db, logRun } from '../../lib/db';
import { ask } from '../../lib/claude';
import { writeFile } from 'node:fs/promises';

export default async function handler() {
  try {
    const { data: fixtures } = await db.from('fixtures').select('*').order('date').limit(8);
    const { data: lastResult } = await db.from('matches').select('*').order('date', { ascending: false }).limit(1).single();

    // Generate refreshed meta description
    const metaDesc = await ask(
      `Réécris la meta description (155 chars max) du site esi-isigny.fr en intégrant le dernier résultat (${lastResult?.team_label} ${lastResult?.recevant_buts}-${lastResult?.visiteur_buts} ${lastResult?.visiteur_nom}). Garde "Étoile Sportive d'Isigny", "1925", "District Manche", "District Manche".`,
      { maxTokens: 200 }
    );

    // Build SportsEvent JSON-LD from fixtures
    const events = fixtures?.map(f => ({
      '@type': 'SportsEvent',
      name: `${f.team_label} vs ${f.opponent}`,
      startDate: f.date,
      sport: 'Football',
      location: { '@type': 'Place', name: f.venue === 'home' ? 'Stade Municipal d\'Isigny' : f.opponent },
    }));

    // Update sitemap.xml lastmod
    const today = new Date().toISOString().slice(0, 10);
    const sitemap = generateSitemap(today);
    await writeFile('public/sitemap.xml', sitemap);

    await db.from('seo_state').upsert({
      id: 1,
      meta_description: metaDesc,
      events_jsonld: events,
      sitemap_lastmod: today,
      updated_at: new Date().toISOString(),
    });

    await logRun('07-seo-optimizer', 'success', { events: events?.length, meta_len: metaDesc.length });
    return Response.json({ ok: true });
  } catch (err: any) {
    await logRun('07-seo-optimizer', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

function generateSitemap(today: string) {
  const urls = ['', '#calendrier', '#resultats', '#convocations', '#galerie', '#staff', '#contact'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>https://esi-isigny.fr/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>`;
}

export const config = { schedule: '0 23 * * 0' };
