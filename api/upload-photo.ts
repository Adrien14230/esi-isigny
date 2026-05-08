// POST /api/upload-photo
// Receives photos from the parents' upload form on the gallery page.
// Photos are published immediately (no moderation step — confiance aux parents).
// Stores originals in Supabase Storage and writes to gallery_approved.
// Uses direct Supabase REST + Storage API (no SDK) for Edge Runtime compatibility.

import { sbInsert, sbStorageUpload, logRun } from '../lib/supabase.js';

export const runtime = 'edge';

const ALLOWED_CATEGORIES = [
  'seniors-a', 'seniors-b', 'seniors-f', 'veterans',
  'u15-1', 'u15-2', 'u13', 'u11', 'u9', 'club',
];
const MAX_PHOTOS = 10;
const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const form = await req.formData();
    const category = String(form.get('category') || '');
    const title = String(form.get('title') || '').slice(0, 80);
    const photos = form.getAll('photos') as File[];

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

      const upload = await sbStorageUpload('gallery', path, photo, photo.type);
      if (!upload.ok) throw new Error(`Upload failed: ${upload.status}`);

      await sbInsert('gallery_approved', {
        id, category, title, path,
        approved_at: new Date().toISOString(),
      });

      inserted.push(id);
    }

    await logRun('upload-photo', 'success', { count: inserted.length, category });
    return Response.json({ ok: true, ids: inserted });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
