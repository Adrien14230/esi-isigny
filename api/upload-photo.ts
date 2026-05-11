// POST /api/upload-photo
// Self-contained Edge function — pas d'imports relatifs (Vercel Edge bundler bug).

export const runtime = 'edge';

const ALLOWED_CATEGORIES = ['seniors-a', 'seniors-b', 'seniors-f', 'veterans', 'u15-1', 'u15-2', 'u13', 'u11', 'u9', 'club'];
const MAX_PHOTOS = 10;
const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const SB_URL = process.env.SUPABASE_URL || '';
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SB_URL || !SB_KEY) {
    return Response.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  try {
    const form = await req.formData();
    const category = String(form.get('category') || '');
    const title = String(form.get('title') || '').slice(0, 80);
    const photos = form.getAll('photos') as File[];

    if (!ALLOWED_CATEGORIES.includes(category)) return Response.json({ error: 'Invalid category' }, { status: 400 });
    if (!photos.length || photos.length > MAX_PHOTOS) return Response.json({ error: `1 to ${MAX_PHOTOS} photos required` }, { status: 400 });
    for (const p of photos) {
      if (!ALLOWED_TYPES.includes(p.type)) return Response.json({ error: `Type not allowed: ${p.type}` }, { status: 400 });
      if (p.size > MAX_SIZE) return Response.json({ error: `File too large: ${p.name}` }, { status: 400 });
    }

    const inserted: string[] = [];
    for (const photo of photos) {
      const ext = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const path = `approved/${category}/${id}.${ext}`;

      const upRes = await fetch(`${SB_URL}/storage/v1/object/gallery/${path}`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': photo.type, 'x-upsert': 'true' },
        body: photo,
      });
      if (!upRes.ok) throw new Error(`Upload failed: ${upRes.status}`);

      const insRes = await fetch(`${SB_URL}/rest/v1/gallery_approved`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id, category, title, path, approved_at: new Date().toISOString() }),
      });
      if (!insRes.ok) throw new Error(`DB insert failed: ${insRes.status}`);

      inserted.push(id);
    }

    return Response.json({ ok: true, ids: inserted });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
