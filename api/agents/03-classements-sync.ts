// AGENT 03 — Classements Sync
// Runs Monday 03:00. Scrapes the full standings table for each of the
// 7 active ESI competition pools and persists in DB.

import { fetchClassement } from '../../lib/fff';
import { db, logRun } from '../../lib/db';

const POOLS = [
  { key: 'seniors-a',  path: '/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/3/accueil' },
  { key: 'seniors-b',  path: '/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/4/accueil' },
  { key: 'seniors-f',  path: '/competition/engagement/440195-seniors-f-a-8-sport-200-lequertier/phase/1/2/accueil' },
  { key: 'veterans',   path: '/competition/engagement/441428-championnat-veterans/phase/1/2/accueil' },
  { key: 'u15-1',      path: '/competition/engagement/445255-championnat-u15-d3/phase/2/2/accueil' },
  { key: 'u15-2',      path: '/competition/engagement/445255-championnat-u15-d3/phase/2/3/accueil' },
  { key: 'u13',        path: '/competition/engagement/445894-championnat-u13-niveau-4/phase/2/2/accueil' },
];

export default async function handler() {
  try {
    let total = 0;
    for (const pool of POOLS) {
      const rows = await fetchClassement(pool.path);
      for (const r of rows) {
        await db.from('classements').upsert({
          pool_key: pool.key, position: r.pos, team: r.team,
          pts: r.pts, j: r.j, g: r.g, n: r.n, p: r.p, bp: r.bp, bc: r.bc, diff: r.diff,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'pool_key,position' });
        total++;
      }
    }
    await logRun('03-classements-sync', 'success', { rows: total });
    return Response.json({ ok: true, rows: total });
  } catch (err: any) {
    await logRun('03-classements-sync', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const config = { schedule: '0 3 * * 1' };
