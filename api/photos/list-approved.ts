// GET /api/photos/list-approved?category=<key>
// Public endpoint. Lists approved photos for a category, with signed URLs.
// Uses direct Supabase REST API (no SDK) for Edge Runtime compatibility.

import { sbSelect } from '../../lib/supabase.js';

export const runtime = 'edge';

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

async function signedUrl(bucket: string, path: string, expiresIn = 3600) {
  const res = await fetch(`${SB_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return null;
  const { signedURL } = await res.json();
  return signedURL ? `${SB_URL}/storage/v1${signedURL}` : null;
}

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const query = `select=*&order=approved_at.desc&limit=60${category ? `&category=eq.${category}` : ''}`;
    const data = await sbSelect<any>('gallery_approved', query);

    const photos = await Promise.all(data.map(async (p) => ({
      id: p.id,
      category: p.category,
      title: p.title,
      url: await signedUrl('gallery', p.path),
    })));

    return Response.json({ photos }, { headers: { 'Cache-Control': 's-maxage=300' } });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
