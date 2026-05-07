// GET /api/photos/list-approved?category=<key>
// Public endpoint. Lists approved photos for a category, with signed URLs.

import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export default async function handler(req: Request) {
  const db = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');
  const url = new URL(req.url);
  const category = url.searchParams.get('category');

  let q = db.from('gallery_approved').select('*').order('approved_at', { ascending: false }).limit(60);
  if (category) q = q.eq('category', category);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const photos = await Promise.all((data || []).map(async (p) => {
    const { data: signed } = await db.storage.from('gallery')
      .createSignedUrl(p.path, 3600); // 1h URL
    return { id: p.id, category: p.category, title: p.title, url: signed?.signedUrl };
  }));

  return Response.json({ photos }, { headers: { 'Cache-Control': 's-maxage=300' } });
}
