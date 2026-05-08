// AGENT 03 — Classements Sync
// Lundi 3h. Scrape les classements des 7 poules ESI → table classements.
import { fetchClassement } from '../fff.js';
import { sbUpsert, logRun } from '../supabase.js';

const POOLS = [
  { key: 'seniors-a',  path: '/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/3/accueil' },
  { key: 'seniors-b',  path: '/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/4/accueil' },
  { key: 'seniors-f',  path: '/competition/engagement/440195-seniors-f-a-8-sport-200-lequertier/phase/1/2/accueil' },
  { key: 'veterans',   path: '/competition/engagement/441428-championnat-veterans/phase/1/2/accueil' },
  { key: 'u15-1',      path: '/competition/engagement/445255-championnat-u15-d3/phase/2/2/accueil' },
  { key: 'u15-2',      path: '/competition/engagement/445255-championnat-u15-d3/phase/2/3/accueil' },
  { key: 'u13',        path: '/competition/engagement/445894-championnat-u13-niveau-4/phase/2/2/accueil' },
];

export async function run() {
  try {
    let total = 0;
    for (const pool of POOLS) {
      const rows = await fetchClassement(pool.path);
      for (const r of rows) {
        await sbUpsert('classements', {
          pool_key: pool.key,
          position: r.pos,
          team: r.team,
          pts: r.pts, j: r.j, g: r.g, n: r.n, p: r.p, bp: r.bp, bc: r.bc, diff: r.diff,
          synced_at: new Date().toISOString(),
        }, 'pool_key,position');
        total++;
      }
    }
    await logRun('03-classements-sync', 'success', { rows: total });
    return { ok: true, rows: total };
  } catch (err: any) {
    await logRun('03-classements-sync', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
