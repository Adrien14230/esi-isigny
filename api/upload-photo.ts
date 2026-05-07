// POST /api/upload-photo
// Receives photos from the parents' upload form on the gallery page.
// Photos are published immediately (no moderation step — confiance aux parents).
// Stores originals in Supabase Storage and writes to gallery_approved.

import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

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

  const db = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');

  try {
    const form = await req.formData();
    const category = String(form.get('category') || '');
    const title = String(form.get('title') || '').slice(0, 80);
    const photos = form.getAll('photos') as File[];

    // Validate
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return Response.json({ error: 'Invalid category' }, { status: 400 });
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
      const path = `approved/${category}/${id}.${ext}`;

      // Upload to Supabase Storage (directly in approved/, no pending step)
      const { error: upErr } = await db.storage.from('gallery').upload(path, photo, {
        contentType: photo.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      // Insert directly in gallery_approved — published immediately
      const { error: dbErr } = await db.from('gallery_approved').insert({
        id, category, title, path,
        approved_at: new Date().toISOString(),
      });
      if (dbErr) throw dbErr;

      inserted.push(id);

      // Trigger thumbnail generation in background (non-blocking)
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/agents/08-image-optimizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: path, album_key: category, photo_id: id }),
      }).catch(() => {/* non-blocking */});
    }

    await db.from('agent_runs').insert({
      agent_id: 'upload-photo',
      status: 'success',
      meta: { count: inserted.length, category },
      ran_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, ids: inserted });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

