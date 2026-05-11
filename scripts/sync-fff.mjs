// scripts/sync-fff.mjs
// Scrape les données FFF de l'ESI Isigny et les écrit dans assets/data/
// Tourne via GitHub Actions chaque lundi 2h UTC (4h Paris).
// Pas de Vercel, pas de Supabase — juste Node 20 + fetch global.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const FFF_BASE = 'https://epreuves.fff.fr';
const ESI_CLCOD = '501416';
const TEAM_LABELS = {
  '1': 'Seniors B', '2': 'Seniors A', '5': 'Vétérans',
  '3': 'Seniors F', '6': 'U15 (1)', '9': 'U15 (2)',
  '4': 'U13', '7': 'Foot animation 1', '8': 'Foot animation 2',
};

async function fetchClubPage() {
  const url = `${FFF_BASE}/competition/club/${ESI_CLCOD}-e-s-isigny-s-mer/club`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ESI-Bot/1.0 (esi-isigny.fr)' } });
  if (!res.ok) throw new Error(`FFF fetch failed: ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script[^>]*>([^<]*?"equipes":\[[^<]+)<\/script>/);
  if (!m) throw new Error('Could not find embedded FFF data');
  return JSON.parse(m[1]);
}

function parseMatches(data, monthKey) {
  const key = Object.keys(data).find(k => k.includes('matches') && k.includes(monthKey));
  if (!key) return [];
  const members = data[key].body?.['hydra:member'] || data[key].body || [];
  const out = [];
  for (const m of members) {
    try {
      const d = m.donneesFormatees || m;
      const rec = d.recevant || {};
      const vis = d.visiteur || {};
      const recClub = rec.club || {};
      const visClub = vis.club || {};
      const esiHome = recClub.clCod === ESI_CLCOD;
      const esiEqNo = esiHome ? rec.equipe?.eqNo : vis.equipe?.eqNo;
      out.push({
        id: d.maNo || d.id || `${Date.now()}-${Math.random()}`,
        date: d.date || d.maDate,
        status: d.maStatutLib || d.status,
        competition: d.competition?.donneesFormatees?.nom || d.competition?.nom || '',
        category: d.competition?.donneesFormatees?.lcLib || d.competition?.lcLib || '',
        pool: d.groupe?.nom || '',
        teamLabel: TEAM_LABELS[esiEqNo] || (esiEqNo ? `eqNo ${esiEqNo}` : 'Inconnu'),
        recevant: { nom: recClub.nom || '', logo: recClub.logo || '', buts: rec.buts ?? null },
        visiteur: { nom: visClub.nom || '', logo: visClub.logo || '', buts: vis.buts ?? null },
        esiHome,
      });
    } catch (err) {
      console.warn('  ⚠️ Skipped malformed match:', err.message);
    }
  }
  return out;
}

async function write(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
  console.log(`✓ Wrote ${path} (${JSON.stringify(data).length} bytes)`);
}

const POOLS = [
  { key: 'seniors-a',  label: 'Seniors A',  path: '/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/3/accueil' },
  { key: 'seniors-b',  label: 'Seniors B',  path: '/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/4/accueil' },
  { key: 'seniors-f',  label: 'Seniors F',  path: '/competition/engagement/440195-seniors-f-a-8-sport-200-lequertier/phase/1/2/accueil' },
  { key: 'veterans',   label: 'Vétérans',   path: '/competition/engagement/441428-championnat-veterans/phase/1/2/accueil' },
  { key: 'u15-1',      label: 'U15 (1)',    path: '/competition/engagement/445255-championnat-u15-d3/phase/2/2/accueil' },
  { key: 'u15-2',      label: 'U15 (2)',    path: '/competition/engagement/445255-championnat-u15-d3/phase/2/3/accueil' },
  { key: 'u13',        label: 'U13',        path: '/competition/engagement/445894-championnat-u13-niveau-4/phase/2/2/accueil' },
];

async function fetchClassement(pool) {
  try {
    const url = `${FFF_BASE}${pool.path}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ESI-Bot/1.0' } });
    if (!res.ok) return null;
    const html = await res.text();
    // Le site FFF est en Angular avec ng-state — pas __NEXT_DATA__
    const m = html.match(/<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    const json = JSON.parse(m[1]);
    // Cherche la clé api/data/classement_journees → body.hydra:member[0].donneesFormatees
    const key = Object.keys(json).find(k => k.includes('classement_journees'));
    if (!key) return null;
    const rows = json[key]?.body?.['hydra:member']?.[0]?.donneesFormatees;
    if (!Array.isArray(rows)) return null;
    return rows.map(r => ({
      position: parseInt(r.classement, 10) || 0,
      team: r.nomEquipe || '',
      teamShort: r.nomEquipeAbr || '',
      clCod: r.clCod || '',
      pts: parseInt(r.points, 10) || 0,
      j: parseInt(r.nbMatch, 10) || 0,
      g: parseInt(r.nbMatchGagne, 10) || 0,
      n: parseInt(r.nbMatchNul, 10) || 0,
      p: parseInt(r.nbMatchPe, 10) || 0,
      bp: parseInt(r.nbButPour, 10) || 0,
      bc: parseInt(r.nbButContre, 10) || 0,
      diff: parseInt(r.diffBut, 10) || 0,
      forme: r.serieEnCours || [],
    }));
  } catch (err) {
    console.warn(`  ⚠️ Classement ${pool.key} fetch failed:`, err.message);
    return null;
  }
}

async function main() {
  console.log('🏈 ESI FFF Sync started');
  const data = await fetchClubPage();
  const now = new Date();
  const m1 = now.toISOString().slice(0, 7);
  const next = new Date(now); next.setMonth(next.getMonth() + 1);
  const m2 = next.toISOString().slice(0, 7);

  const allMatches = [...parseMatches(data, m1), ...parseMatches(data, m2)];
  const played = allMatches.filter(m => m.status === 'joué');
  const upcoming = allMatches.filter(m => m.status === 'à venir');

  console.log(`📊 Found ${played.length} played + ${upcoming.length} upcoming matches`);

  await write('assets/data/matches.json', {
    generated_at: new Date().toISOString(),
    played,
    upcoming,
  });

  // Aggregate stats per team
  const byTeam = {};
  for (const m of played) {
    const t = m.teamLabel;
    const esiButs = m.esiHome ? m.recevant.buts : m.visiteur.buts;
    const oppButs = m.esiHome ? m.visiteur.buts : m.recevant.buts;
    byTeam[t] ||= { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
    byTeam[t].played++;
    byTeam[t].gf += esiButs || 0;
    byTeam[t].ga += oppButs || 0;
    if (esiButs > oppButs) byTeam[t].wins++;
    else if (esiButs === oppButs) byTeam[t].draws++;
    else byTeam[t].losses++;
  }

  await write('assets/data/stats.json', {
    generated_at: new Date().toISOString(),
    season: '2025-26',
    per_team: byTeam,
  });

  // Classements (7 poules)
  console.log('📋 Fetching classements...');
  const classements = {};
  for (const pool of POOLS) {
    const rows = await fetchClassement(pool);
    if (rows && rows.length) {
      classements[pool.key] = { label: pool.label, rows };
      console.log(`  ✓ ${pool.label}: ${rows.length} équipes`);
    } else {
      console.log(`  ⚠️ ${pool.label}: pas de classement trouvé`);
    }
  }

  await write('assets/data/classements.json', {
    generated_at: new Date().toISOString(),
    pools: classements,
  });

  console.log('✅ Sync done');
}

main().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
