// AGENT 08 — Image Optimizer
// Sharp ne marche pas sur Edge Runtime. Pour Hobby/dispatcher mode, on utilise
// directement le pipeline natif Vercel Image Optimization (URL /_vercel/image?...)
// qui sert WebP + thumbnails à la volée sans nécessiter de pré-traitement.
// Cet agent reste donc minimal — il enregistre juste la photo dans la table.
import { sbInsert, logRun } from '../supabase';

interface ImageJob { source_path: string; album_key: string; }

export async function run(req?: Request) {
  try {
    if (!req) {
      return { ok: false, error: 'Image optimizer requires POST request with body' };
    }

    const { source_path, album_key }: ImageJob = await req.json();
    if (!source_path || !album_key) {
      return { ok: false, error: 'source_path and album_key required' };
    }

    // Avec Vercel Image Optimization, les thumbs sont générés à la volée via /_vercel/image
    // Pas besoin de pré-générer — on enregistre juste les paths.
    const thumbPath = `/_vercel/image?url=${encodeURIComponent(source_path)}&w=400&q=78`;
    const webpPath = `/_vercel/image?url=${encodeURIComponent(source_path)}&w=1600&q=86`;

    await sbInsert('gallery_photos', {
      album_key,
      source_path,
      thumb_path: thumbPath,
      webp_path: webpPath,
      created_at: new Date().toISOString(),
    });

    await logRun('08-image-optimizer', 'success', { source_path });
    return { ok: true, thumb: thumbPath, webp: webpPath };
  } catch (err: any) {
    await logRun('08-image-optimizer', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
