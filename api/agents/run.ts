// DISPATCHER — Single Vercel Edge function qui route vers les 10 agents.
// Permet de rester sous la limite 12 fonctions du plan Hobby tout en supportant
// tous les agents. Appel : GET /api/agents/run?id=01 (ou 02, 03, ... 10).
//
// Auth :
//   - Vercel Cron envoie automatiquement Authorization: Bearer ${CRON_SECRET}
//   - Pour test manuel, ajouter ?secret=<CRON_SECRET> à l'URL
//
// Architecture : dynamic imports — chaque agent est chargé à la demande,
// donc une erreur dans un agent n'empêche pas les autres de fonctionner.

export const runtime = 'edge';

const AGENT_LOADERS: Record<string, () => Promise<{ run: (req?: Request) => Promise<any> }>> = {
  '01': () => import('../../lib/agents/01-fff-results-sync'),
  '02': () => import('../../lib/agents/02-fff-fixtures-sync'),
  '03': () => import('../../lib/agents/03-classements-sync'),
  '04': () => import('../../lib/agents/04-match-report-writer'),
  '05': () => import('../../lib/agents/05-convoc-reminder'),
  '06': () => import('../../lib/agents/06-social-poster'),
  '07': () => import('../../lib/agents/07-seo-optimizer'),
  '08': () => import('../../lib/agents/08-image-optimizer'),
  '09': () => import('../../lib/agents/09-stats-aggregator'),
  '10': () => import('../../lib/agents/10-chatbot-trainer'),
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').slice(0, 2);
  const querySecret = url.searchParams.get('secret') || '';
  const expectedSecret = process.env.CRON_SECRET || '';

  // Auth : Vercel Cron envoie Bearer header, ou ?secret=X manuel
  const authHeader = req.headers.get('authorization') || '';
  const cronAuth = expectedSecret && authHeader === `Bearer ${expectedSecret}`;
  const querAuth = expectedSecret && querySecret === expectedSecret;

  if (expectedSecret && !cronAuth && !querAuth) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!id) {
    return Response.json({
      ok: false,
      error: 'Missing ?id parameter (01..10)',
      available: Object.keys(AGENT_LOADERS),
    }, { status: 400 });
  }

  const loader = AGENT_LOADERS[id];
  if (!loader) {
    return Response.json({
      ok: false,
      error: `Unknown agent id "${id}"`,
      available: Object.keys(AGENT_LOADERS),
    }, { status: 404 });
  }

  try {
    const mod = await loader();
    const result = await mod.run(req);
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (err: any) {
    return Response.json({
      ok: false,
      error: err.message || String(err),
      stack: err.stack?.slice(0, 800),
    }, { status: 500 });
  }
}
