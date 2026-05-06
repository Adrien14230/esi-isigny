// AGENT 10 — Chatbot Knowledge Refresh
// Runs Sunday 22:00. Pulls the latest data (matches, classements, fixtures,
// news) and rebuilds the chatbot knowledge base (a JSON file the front-end loads).
// This is what makes the chatbot "auto-update" on the site.

import { db, logRun } from '../../lib/db';
import { writeFile } from 'node:fs/promises';

export default async function handler() {
  try {
    const [matches, fixtures, classements, news, stats] = await Promise.all([
      db.from('matches').select('*').order('date', { ascending: false }).limit(20),
      db.from('fixtures').select('*').order('date').limit(20),
      db.from('classements').select('*'),
      db.from('news').select('*').order('published_at', { ascending: false }).limit(10),
      db.from('club_stats').select('*').single(),
    ]);

    const knowledge = {
      generated_at: new Date().toISOString(),
      next_match: fixtures.data?.[0],
      recent_results: matches.data?.slice(0, 8),
      classements: classements.data,
      latest_news: news.data,
      club_stats: stats.data,
      // Pre-computed answers for common questions
      quick_facts: {
        founded: 1925,
        teams: 9,
        district: 'Manche',
        league: 'Normandie',
        stadium: 'Stade Municipal · Impasse du Stade · 14230 Isigny-sur-Mer',
        contact: 'etoilesportiveisigny@gmail.com',
      },
    };

    // Write to public file the front-end can fetch
    await writeFile('public/chatbot-knowledge.json', JSON.stringify(knowledge, null, 2));

    await logRun('10-chatbot-trainer', 'success', {
      results: matches.data?.length || 0,
      fixtures: fixtures.data?.length || 0,
      classements: classements.data?.length || 0,
    });
    return Response.json({ ok: true });
  } catch (err: any) {
    await logRun('10-chatbot-trainer', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const config = { schedule: '0 22 * * 0' };
