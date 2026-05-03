// _shared/fff.ts
// FFF.fr scraper. Extracts club data, fixtures, results, classements
// from the Next.js __NEXT_DATA__ blob embedded in the public HTML.
// Works without API keys — same technique as the live site scraping.

const FFF_BASE = 'https://epreuves.fff.fr';
const ESI_CLNO = 948;       // Internal FFF ID
const ESI_CLCOD = '501416'; // Public affiliation number

export interface MatchData {
  id: string;
  date: string;        // ISO
  status: 'à venir' | 'joué' | 'reporté' | string;
  competition: string;
  category: string;
  phase: string;
  pool: string;
  recevant: { nom: string; clCod: string; logo: string; buts: number | null; resu: string | null; eqNo: string };
  visiteur: { nom: string; clCod: string; logo: string; buts: number | null; resu: string | null; eqNo: string };
  esiHome: boolean;
  esiTeamLabel: string; // 'Seniors A', 'U15 (1)', etc.
}

export interface ClubData {
  name: string;
  clNo: number;
  clCod: string;
  founded: number;
  district: string;
  league: string;
  address: string[];
  geo: { lat: number; lng: number };
  teams: Array<{ id: string; libelle: string; eqNo: string; lcLib: string }>;
}

const TEAM_LABELS: Record<string, string> = {
  '1': 'Seniors B', '2': 'Seniors A', '5': 'Vétérans',
  '3': 'Seniors F', '6': 'U15 (1)', '9': 'U15 (2)',
  '4': 'U13', '7': 'Foot animation 1', '8': 'Foot animation 2',
};

/**
 * Fetch the FFF club page and extract the embedded __NEXT_DATA__ JSON.
 */
export async function fetchClubPage(): Promise<any> {
  const url = `${FFF_BASE}/competition/club/${ESI_CLCOD}-e-s-isigny-s-mer/club`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ESI-Bot/1.0 (esi-isigny.fr)' } });
  if (!res.ok) throw new Error(`FFF fetch failed: ${res.status}`);
  const html = await res.text();
  // The data is in the 5th <script> tag (no id, just inline JSON)
  const matches = html.match(/<script[^>]*>([^<]*?"equipes":\[[^<]+)<\/script>/);
  if (!matches) throw new Error('Could not find embedded FFF data');
  return JSON.parse(matches[1]);
}

export function parseClub(data: any): ClubData {
  const club = data['analog_/api/data/clubs/clCod/501416'].body;
  return {
    name: club.nom,
    clNo: club.clNo,
    clCod: club.clCod,
    founded: 1925, // FFF doesn't expose this; hardcoded from history
    district: club.parent.nom,
    league: club.parent.parent.nom,
    address: club.adresse,
    geo: { lat: parseFloat(club.geolocalisation.lat), lng: parseFloat(club.geolocalisation.long) },
    teams: club.equipes.map((e: any) => ({
      id: e.id, libelle: e.libelle, eqNo: e.eqNo, lcLib: e.lcLib
    })),
  };
}

export function parseMatches(data: any, monthKey: string): MatchData[] {
  const key = Object.keys(data).find(k => k.includes('matches') && k.includes(monthKey));
  if (!key) return [];
  const members = data[key].body['hydra:member'] || [];
  return members.map((m: any) => {
    const d = m.donneesFormatees;
    const rec = d.recevant; const vis = d.visiteur;
    const esiHome = rec.club?.clCod === ESI_CLCOD;
    const esiEqNo = esiHome ? rec.equipe?.eqNo : vis.equipe?.eqNo;
    return {
      id: d.maNo,
      date: d.date,
      status: d.maStatutLib,
      competition: d.competition.donneesFormatees.nom,
      category: d.competition.donneesFormatees.lcLib,
      phase: d.phase?.nom?.trim() || '',
      pool: d.groupe?.nom || '',
      recevant: {
        nom: rec.club?.nom, clCod: rec.club?.clCod, logo: rec.club?.logo,
        buts: rec.buts, resu: rec.resu, eqNo: rec.equipe?.eqNo,
      },
      visiteur: {
        nom: vis.club?.nom, clCod: vis.club?.clCod, logo: vis.club?.logo,
        buts: vis.buts, resu: vis.resu, eqNo: vis.equipe?.eqNo,
      },
      esiHome,
      esiTeamLabel: TEAM_LABELS[esiEqNo] || `eqNo ${esiEqNo}`,
    };
  });
}

/**
 * Fetch a competition standings page and parse the table.
 * URL example: /competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/3/accueil
 */
export async function fetchClassement(compEngagementPath: string): Promise<Array<any>> {
  // Note: standings table is rendered server-side in HTML, can be parsed with regex/cheerio
  // For brevity, this stub returns empty. Implementation would use cheerio.
  return [];
}

export const CONFIG = { FFF_BASE, ESI_CLNO, ESI_CLCOD, TEAM_LABELS };
