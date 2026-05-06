// AGENT 08 — Image Optimizer
// Triggered when a dirigeant uploads photos to /assets/gallery/.
// Converts each upload to WebP, generates a 400px thumbnail, optimizes JPEG quality.

import { db, logRun } from '../../lib/db';
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

interface ImageJob { source_path: string; album_key: string; }

export default async function handler(req: Request) {
  try {
    const { source_path, album_key }: ImageJob = await req.json();
    const buf = await readFile(source_path);

    // Generate thumbnail (square 400x400 cover)
    const thumb = await sharp(buf).resize(400, 400, { fit: 'cover' }).webp({ quality: 78 }).toBuffer();
    const thumbPath = source_path.replace(/\.(jpe?g|png)$/i, '.thumb.webp');
    await writeFile(thumbPath, thumb);

    // Generate full-size WebP (~1600px max width)
    const full = await sharp(buf).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
    const fullPath = source_path.replace(/\.(jpe?g|png)$/i, '.webp');
    await writeFile(fullPath, full);

    await db.from('gallery_photos').insert({
      album_key, source_path, thumb_path: thumbPath, webp_path: fullPath,
      created_at: new Date().toISOString(),
    });

    await logRun('08-image-optimizer', 'success', { source_path });
    return Response.json({ ok: true, thumb: thumbPath, webp: fullPath });
  } catch (err: any) {
    await logRun('08-image-optimizer', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
// Trigger : webhook depuis l'upload form de l'espace dirigeant.
