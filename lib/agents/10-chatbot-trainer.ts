// AGENT 10 — Chatbot Knowledge Refresh
// Dimanche 22h. Compile les dernières données (matches, classements, fixtures, news, stats)
// dans une knowledge base JSON. Sur Edge Runtime, pas de filesystem — on stocke dans
// Supabase Storage (bucket 'public/chatbot') que le frontend peut fetcher.
import { sbSelect, sbStorageUpload, logRun } from '../supabase.js';

export async function run() {
  try {
    const [matches, fixtures, classements, news, statsArr] = await Promise.all([
      sbSelect<any>('matches', 'select=*&order=date.desc&limit=20'),
      sbSelect<any>('fixtures', 'select=*&order=date.asc&limit=20'),
      sbSelect<any>('classements', 'select=*'),
      sbSelect<any>('news', 'select=*&order=published_at.desc&limit=10'),
      sbSelect<any>('club_stats', 'select=*&id=eq.1'),
    ]);

    const knowledge = {
      generated_at: new Date().toISOString(),
      next_match: fixtures[0] || null,
      recent_results: matches.slice(0, 8),
      classements,
      latest_news: news,
      club_stats: statsArr[0] || null,
      quick_facts: {
        founded: 1925,
        teams: 9,
        district: 'Manche',
        league: 'Normandie',
        stadium: 'Stade Municipal · Impasse du Stade · 14230 Isigny-sur-Mer',
        contact: 'etoilesportiveisigny@gmail.com',
      },
    };

    const blob = new Blob([JSON.stringify(knowledge, null, 2)], { type: 'application/json' });
    const upload = await sbStorageUpload('chatbot', 'knowledge.json', blob, 'application/json');

    await logRun('10-chatbot-trainer', upload.ok ? 'success' : 'error', {
      results: matches.length,
      fixtures: fixtures.length,
      classements: classements.length,
      upload_status: upload.status,
    });
    return { ok: upload.ok, upload_status: upload.status };
  } catch (err: any) {
    await logRun('10-chatbot-trainer', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
