// DISPATCHER — Single Vercel Edge function qui route vers les 10 agents.
// Permet de rester sous la limite 12 fonctions du plan Hobby tout en supportant
// tous les agents. Appel : GET /api/agents/run?id=01 (ou 02, 03, ... 10).
//
// Auth :
//   - Vercel Cron envoie automatiquement Authorization: Bearer ${CRON_SECRET}
//   - Pour test manuel, ajouter ?secret=<CRON_SECRET> à l'URL
//
// Liste des agents (cf vercel.json crons) :
//   01-fff-results-sync      Lundi    02:00
//   02-fff-fixtures-sync     Lundi    02:30
//   03-classements-sync      Lundi    03:00
//   04-match-report-writer   Lundi    04:00   (besoin ANTHROPIC_API_KEY)
//   05-convoc-reminder       Tous     18:00   (besoin RESEND_API_KEY pour les emails)
//   06-social-poster         Lundi    09:00   (besoin META_* + ANTHROPIC_API_KEY)
//   07-seo-optimizer         Dim      23:00   (besoin ANTHROPIC_API_KEY)
//   08-image-optimizer       sur appel (POST avec source_path/album_key)
//   09-stats-aggregator      Lundi    05:00
//   10-chatbot-trainer       Dim      22:00

import { run as agent01 } from '../../lib/agents/01-fff-results-sync.js';
import { run as agent02 } from '../../lib/agents/02-fff-fixtures-sync.js';
import { run as agent03 } from '../../lib/agents/03-classements-sync.js';
import { run as agent04 } from '../../lib/agents/04-match-report-writer.js';
import { run as agent05 } from '../../lib/agents/05-convoc-reminder.js';
import { run as agent06 } from '../../lib/agents/06-social-poster.js';
import { run as agent07 } from '../../lib/agents/07-seo-optimizer.js';
import { run as agent08 } from '../../lib/agents/08-image-optimizer.js';
import { run as agent09 } from '../../lib/agents/09-stats-aggregator.js';
import { run as agent10 } from '../../lib/agents/10-chatbot-trainer.js';

export const runtime = 'edge';

const AGENTS: Record<string, (req?: Request) => Promise<any>> = {
  '01': agent01, '01-fff-results-sync': agent01,
  '02': agent02, '02-fff-fixtures-sync': agent02,
  '03': agent03, '03-classements-sync': agent03,
  '04': agent04, '04-match-report-writer': agent04,
  '05': agent05, '05-convoc-reminder': agent05,
  '06': agent06, '06-social-poster': agent06,
  '07': agent07, '07-seo-optimizer': agent07,
  '08': agent08, '08-image-optimizer': agent08,
  '09': agent09, '09-stats-aggregator': agent09,
  '10': agent10, '10-chatbot-trainer': agent10,
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  const querySecret = url.searchParams.get('secret') || '';
  const expectedSecret = process.env.CRON_SECRET || '';

  // Auth check : Vercel Cron header OR query secret OR no auth in dev
  const authHeader = req.headers.get('authorization') || '';
  const cronAuth = authHeader === `Bearer ${expectedSecret}`;
  const querAuth = expectedSecret && querySecret === expectedSecret;

  if (expectedSecret && !cronAuth && !querAuth) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!id) {
    return Response.json({
      ok: false,
      error: 'Missing ?id parameter',
      available: Object.keys(AGENTS).filter(k => /^\d/.test(k) && k.length === 2),
    }, { status: 400 });
  }

  const agent = AGENTS[id];
  if (!agent) {
    return Response.json({
      ok: false,
      error: `Unknown agent id "${id}"`,
      available: Object.keys(AGENTS).filter(k => /^\d/.test(k) && k.length === 2),
    }, { status: 404 });
  }

  try {
    const result = await agent(req);
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (err: any) {
    return Response.json({
      ok: false,
      error: err.message,
      stack: err.stack?.slice(0, 500),
    }, { status: 500 });
  }
}
