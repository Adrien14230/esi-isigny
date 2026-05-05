// POST /api/upload-photo
// Receives photos from the parents' upload form on the gallery page.
// Validates input, stores the originals in Supabase Storage with status=pending,
// and triggers the image-optimizer agent (08) for thumbnail generation.

import { db, logRun } from '../lib/db';

const ALLOWED_CATEGORIES = [
  'seniors-a', 'seniors-b', 'seniors-f', 'veterans',
  'u15-1', 'u15-2', 'u13', 'u11', 'u9', 'club',
];
const MAX_PHOTOS = 10;
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB per photo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const form = await req.formData();
    const category = String(form.get('category') || '');
    const title = String(form.get('title') || '').slice(0, 80);
    const email = String(form.get('email') || '').slice(0, 120);
    const photos = form.getAll('photos') as File[];

    // Validate
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return Response.json({ error: 'Invalid category' }, { status: 400 });
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return Response.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (!photos.length || photos.length > MAX_PHOTOS) {
      return Response.json({ error: `1 to ${MAX_PHOTOS} photos required` }, { status: 400 });
    }
    for (const p of photos) {
      if (!ALLOWED_TYPES.includes(p.type)) {
        return Response.json({ error: `Type not allowed: ${p.type}` }, { status: 400 });
      }
      if (p.size > MAX_SIZE) {
        return Response.json({ error: `File too large: ${p.name}` }, { status: 400 });
      }
    }

    const inserted: string[] = [];

    for (const photo of photos) {
      const ext = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const path = `pending/${category}/${id}.${ext}`;

      // Upload original to Supabase Storage
      const { error: upErr } = await db.storage.from('gallery').upload(path, photo, {
        contentType: photo.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      // Insert DB record (status = pending — admin must approve)
      const { error: dbErr } = await db.from('gallery_pending').insert({
        id,
        category,
        title,
        email,
        original_path: path,
        original_filename: photo.name,
        original_size: photo.size,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      if (dbErr) throw dbErr;

      inserted.push(id);

      // Fire-and-forget: ask agent-08 to generate thumbnail (async, optional)
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/agents/08-image-optimizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: path, album_key: category, photo_id: id }),
      }).catch(() => {/* non-blocking */});
    }

    await logRun('upload-photo', 'success', { count: inserted.length, category });
    return Response.json({ ok: true, ids: inserted });
  } catch (err: any) {
    await logRun('upload-photo', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const config = { api: { bodyParser: false } };
