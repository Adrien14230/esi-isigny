// DISPATCHER ALL-IN-ONE — Zéro imports relatifs, tout inline.
// Edge Runtime sur Vercel a des soucis avec les imports relatifs entre TS files.
// Ce fichier contient les 10 agents directement, sans lib/ ni dépendances npm.

// Node.js runtime (par défaut sur Vercel) — pas de export const runtime nécessaire.
// maxDuration 60s pour les scrapers FFF (peuvent être lents).
export const config = { maxDuration: 60 };

// ============================================================
// SUPABASE REST API (inline)
// ============================================================
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

async function sbFetch(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  if (!SB_URL || !SB_KEY) throw new Error('SUPABASE env vars missing');
  const headers: Record<string, string> = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'content-type': 'application/json',
    Prefer: 'return=representation',
  };
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null };
}

async function sbUpsert(table: string, row: any, onConflict?: string) {
  const path = onConflict ? `${table}?on_conflict=${onConflict}` : table;
  return sbFetch(path, {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(row),
  });
}

async function sbInsert(table: string, row: any) {
  return sbFetch(table, { method: 'POST', body: JSON.stringify(row) });
}

async function sbSelect(table: string, query = ''): Promise<any[]> {
  const sep = query ? '?' : '';
  const r = await sbFetch(`${table}${sep}${query}`);
  return r.ok && Array.isArray(r.body) ? r.body : [];
}

async function sbUpdate(table: string, query: string, patch: any) {
  return sbFetch(`${table}?${query}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

async function logRun(agentId: string, status: 'success' | 'error', meta: any = {}) {
  try {
    await sbInsert('agent_runs', { agent_id: agentId, status, meta, ran_at: new Date().toISOString() });
  } catch (_) { /* don't crash on logging */ }
}

// ============================================================
// FFF SCRAPER (inline)
// ============================================================
const FFF_BASE = 'https://epreuves.fff.fr';
const ESI_CLCOD = '501416';
const TEAM_LABELS: Record<string, string> = {
  '1': 'Seniors B', '2': 'Seniors A', '5': 'Vétérans',
  '3': 'Seniors F', '6': 'U15 (1)', '9': 'U15 (2)',
  '4': 'U13', '7': 'Foot animation 1', '8': 'Foot animation 2',
};

async function fetchClubPage(): Promise<any> {
  const url = `${FFF_BASE}/competition/club/${ESI_CLCOD}-e-s-isigny-s-mer/club`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ESI-Bot/1.0' } });
  if (!res.ok) throw new Error(`FFF fetch failed: ${res.status}`);
  const html = await res.text();
  const matches = html.match(/<script[^>]*>([^<]*?"equipes":\[[^<]+)<\/script>/);
  if (!matches) throw new Error('Could not find embedded FFF data');
  return JSON.parse(matches[1]);
}

function parseMatches(data: any, monthKey: string): any[] {
  const key = Object.keys(data).find(k => k.includes('matches') && k.includes(monthKey));
  if (!key) return [];
  const members = data[key].body['hydra:member'] || [];
  return members.map((m: any) => {
    const d = m.donneesFormatees;
    const rec = d.recevant; const vis = d.visiteur;
    const esiHome = rec.club?.clCod === ESI_CLCOD;
    const esiEqNo = esiHome ? rec.equipe?.eqNo : vis.equipe?.eqNo;
    return {
      id: d.maNo, date: d.date, status: d.maStatutLib,
      competition: d.competition.donneesFormatees.nom,
      category: d.competition.donneesFormatees.lcLib,
      phase: d.phase?.nom?.trim() || '',
      pool: d.groupe?.nom || '',
      recevant: { nom: rec.club?.nom, clCod: rec.club?.clCod, logo: rec.club?.logo, buts: rec.buts, eqNo: rec.equipe?.eqNo },
      visiteur: { nom: vis.club?.nom, clCod: vis.club?.clCod, logo: vis.club?.logo, buts: vis.buts, eqNo: vis.equipe?.eqNo },
      esiHome,
      esiTeamLabel: TEAM_LABELS[esiEqNo] || `eqNo ${esiEqNo}`,
    };
  });
}

// ============================================================
// AGENTS (inline functions)
// ============================================================

// AGENT 01 — FFF Results Sync
async function agent01() {
  try {
    const data = await fetchClubPage();
    const monthKey = new Date().toISOString().slice(0, 7);
    const matches = parseMatches(data, monthKey);
    const played = matches.filter(m => m.status === 'joué');
    for (const m of played) {
      await sbUpsert('matches', {
        id: m.id, date: m.date, status: m.status,
        competition: m.competition, category: m.category, team_label: m.esiTeamLabel,
        recevant_nom: m.recevant.nom, recevant_buts: m.recevant.buts,
        visiteur_nom: m.visiteur.nom, visiteur_buts: m.visiteur.buts,
        esi_home: m.esiHome, synced_at: new Date().toISOString(),
      }, 'id');
    }
    await logRun('01-fff-results-sync', 'success', { played_count: played.length });
    return { ok: true, played: played.length };
  } catch (err: any) {
    await logRun('01-fff-results-sync', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}

// AGENT 02 — FFF Fixtures Sync
async function agent02() {
  try {
    const data = await fetchClubPage();
    const now = new Date();
    const m1 = now.toISOString().slice(0, 7);
    const next = new Date(now); next.setMonth(next.getMonth() + 1);
    const m2 = next.toISOString().slice(0, 7);
    const all = [...parseMatches(data, m1), ...parseMatches(data, m2)];
    const upcoming = all.filter(m => m.status === 'à venir');
    for (const m of upcoming) {
      await sbUpsert('fixtures', {
        id: m.id, date: m.date, competition: m.competition, category: m.category,
        pool: m.pool, team_label: m.esiTeamLabel,
        opponent: m.esiHome ? m.visiteur.nom : m.recevant.nom,
        opponent_logo: m.esiHome ? m.visiteur.logo : m.recevant.logo,
        venue: m.esiHome ? 'home' : 'away',
        synced_at: new Date().toISOString(),
      }, 'id');
    }
    await logRun('02-fff-fixtures-sync', 'success', { upcoming_count: upcoming.length });
    return { ok: true, fixtures: upcoming.length };
  } catch (err: any) {
    await logRun('02-fff-fixtures-sync', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}

// AGENT 03 — Classements Sync (stub — fetchClassement à implémenter)
async function agent03() {
  await logRun('03-classements-sync', 'success', { note: 'stub' });
  return { ok: true, rows: 0, note: 'Classement scraper à implémenter' };
}

// AGENT 04 — Match Report Writer (needs ANTHROPIC_API_KEY)
async function agent04() {
  const KEY = process.env.ANTHROPIC_API_KEY || '';
  try {
    if (!KEY) {
      await logRun('04-match-report-writer', 'success', { skipped: 'ANTHROPIC_API_KEY missing' });
      return { ok: true, skipped: 'ANTHROPIC_API_KEY missing' };
    }
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const matches = await sbSelect('matches', `select=*&has_report=eq.false&date=gte.${encodeURIComponent(since)}`);
    let written = 0;
    for (const m of matches) {
      const score = m.esi_home ? `${m.recevant_buts}-${m.visiteur_buts}` : `${m.visiteur_buts}-${m.recevant_buts}`;
      const result = m.esi_home
        ? (m.recevant_buts > m.visiteur_buts ? 'victoire' : m.recevant_buts < m.visiteur_buts ? 'défaite' : 'nul')
        : (m.visiteur_buts > m.recevant_buts ? 'victoire' : m.visiteur_buts < m.recevant_buts ? 'défaite' : 'nul');
      const prompt = `Compte-rendu court (3-4 phrases, ton club de village) : ESI ${m.team_label} ${result} ${score} contre ${m.esi_home ? m.visiteur_nom : m.recevant_nom} (${m.competition}).`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
      });
      const j = await r.json();
      const text = j.content?.[0]?.text || '';
      await sbInsert('news', { kind: 'match_report', match_id: m.id, body: text, published_at: new Date().toISOString() });
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

// AGENT 05 — Convocation Reminder (needs RESEND_API_KEY)
async function agent05() {
  const RESEND = process.env.RESEND_API_KEY || '';
  try {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const tomorrowEnd = new Date(Date.now() + 2 * 86400000).toISOString();
    const convocs = await sbSelect('convocations', `select=*&match_date=gte.${encodeURIComponent(tomorrow)}&match_date=lt.${encodeURIComponent(tomorrowEnd)}`);
    await logRun('05-convoc-reminder', 'success', { convocs_count: convocs.length, resend_configured: !!RESEND });
    return { ok: true, convocs_count: convocs.length, sent: 0 };
  } catch (err: any) {
    await logRun('05-convoc-reminder', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}

// AGENT 06 — Social Poster (needs META + ANTHROPIC keys)
async function agent06() {
  const META_PAGE_ID = process.env.META_PAGE_ID || '';
  const META_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || '';
  const IG_ID = process.env.IG_BUSINESS_ACCOUNT_ID || '';
  if (!META_PAGE_ID || !META_TOKEN || !IG_ID) {
    await logRun('06-social-poster', 'success', { skipped: 'META keys missing' });
    return { ok: true, skipped: 'META_PAGE_ID, META_PAGE_ACCESS_TOKEN or IG_BUSINESS_ACCOUNT_ID missing' };
  }
  return { ok: true, posted: 0, note: 'Implementation à compléter' };
}

// AGENT 07 — SEO Optimizer
async function agent07() {
  try {
    const fixtures = await sbSelect('fixtures', 'select=*&order=date.asc&limit=8');
    const events = fixtures.map(f => ({
      '@type': 'SportsEvent',
      name: `${f.team_label} vs ${f.opponent}`,
      startDate: f.date,
      sport: 'Football',
      location: { '@type': 'Place', name: f.venue === 'home' ? "Stade Municipal d'Isigny" : f.opponent },
    }));
    const today = new Date().toISOString().slice(0, 10);
    await sbUpsert('seo_state', {
      id: 1,
      meta_description: "Étoile Sportive d'Isigny — Club amateur 1925, District Manche. 9 équipes. Résultats en direct.",
      events_jsonld: events,
      sitemap_lastmod: today,
      updated_at: new Date().toISOString(),
    }, 'id');
    await logRun('07-seo-optimizer', 'success', { events: events.length });
    return { ok: true, events: events.length };
  } catch (err: any) {
    await logRun('07-seo-optimizer', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}

// AGENT 08 — Image Optimizer (placeholder)
async function agent08() {
  return { ok: true, note: 'Use Vercel Image Optimization /_vercel/image directly from frontend' };
}

// AGENT 09 — Stats Aggregator
async function agent09() {
  try {
    const since = new Date('2025-08-01').toISOString();
    const matches = await sbSelect('matches', `select=*&date=gte.${encodeURIComponent(since)}`);
    const byTeam: Record<string, any> = {};
    for (const m of matches) {
      const t = m.team_label;
      const esiButs = m.esi_home ? m.recevant_buts : m.visiteur_buts;
      const oppButs = m.esi_home ? m.visiteur_buts : m.recevant_buts;
      byTeam[t] ||= { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
      byTeam[t].played++;
      byTeam[t].gf += esiButs || 0;
      byTeam[t].ga += oppButs || 0;
      if (esiButs > oppButs) byTeam[t].wins++;
      else if (esiButs === oppButs) byTeam[t].draws++;
      else byTeam[t].losses++;
    }
    const clubTotals = Object.values(byTeam).reduce((acc: any, t: any) => ({
      played: acc.played + t.played, wins: acc.wins + t.wins, draws: acc.draws + t.draws,
      losses: acc.losses + t.losses, gf: acc.gf + t.gf, ga: acc.ga + t.ga,
    }), { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 });
    await sbUpsert('club_stats', {
      id: 1, season: '2025-26', per_team: byTeam, club_totals: clubTotals,
      updated_at: new Date().toISOString(),
    }, 'id');
    await logRun('09-stats-aggregator', 'success', { teams: Object.keys(byTeam).length });
    return { ok: true, teams: Object.keys(byTeam).length, matches: matches.length };
  } catch (err: any) {
    await logRun('09-stats-aggregator', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}

// AGENT 10 — Chatbot Knowledge Refresh
async function agent10() {
  try {
    const [matches, fixtures, classements, news] = await Promise.all([
      sbSelect('matches', 'select=*&order=date.desc&limit=20'),
      sbSelect('fixtures', 'select=*&order=date.asc&limit=20'),
      sbSelect('classements', 'select=*'),
      sbSelect('news', 'select=*&order=published_at.desc&limit=10'),
    ]);
    const statsArr = await sbSelect('club_stats', 'select=*&id=eq.1');
    const knowledge = {
      generated_at: new Date().toISOString(),
      next_match: fixtures[0] || null,
      recent_results: matches.slice(0, 8),
      classements, latest_news: news,
      club_stats: statsArr[0] || null,
      quick_facts: {
        founded: 1925, teams: 9, district: 'Manche', league: 'Normandie',
        stadium: "Stade Municipal · Impasse du Stade · 14230 Isigny-sur-Mer",
        contact: 'etoilesportiveisigny@gmail.com',
      },
    };
    // Upload to Supabase Storage
    const blob = new Blob([JSON.stringify(knowledge, null, 2)], { type: 'application/json' });
    const upRes = await fetch(`${SB_URL}/storage/v1/object/chatbot/knowledge.json`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', 'x-upsert': 'true' },
      body: blob,
    });
    await logRun('10-chatbot-trainer', upRes.ok ? 'success' : 'error', {
      matches: matches.length, fixtures: fixtures.length, classements: classements.length,
      upload_status: upRes.status,
    });
    return { ok: upRes.ok, upload_status: upRes.status };
  } catch (err: any) {
    await logRun('10-chatbot-trainer', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}

// ============================================================
// DISPATCHER HANDLER
// ============================================================
const AGENTS: Record<string, () => Promise<any>> = {
  '01': agent01, '02': agent02, '03': agent03, '04': agent04, '05': agent05,
  '06': agent06, '07': agent07, '08': agent08, '09': agent09, '10': agent10,
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').slice(0, 2);
  const querySecret = url.searchParams.get('secret') || '';
  const expectedSecret = process.env.CRON_SECRET || '';

  const authHeader = req.headers.get('authorization') || '';
  const cronAuth = expectedSecret && authHeader === `Bearer ${expectedSecret}`;
  const querAuth = expectedSecret && querySecret === expectedSecret;

  if (expectedSecret && !cronAuth && !querAuth) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!id || !AGENTS[id]) {
    return Response.json({
      ok: false,
      error: id ? `Unknown agent "${id}"` : 'Missing ?id parameter (01..10)',
      available: Object.keys(AGENTS),
    }, { status: id ? 404 : 400 });
  }

  try {
    const result = await AGENTS[id]();
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (err: any) {
    return Response.json({
      ok: false,
      error: err.message || String(err),
      stack: err.stack?.slice(0, 800),
    }, { status: 500 });
  }
}
