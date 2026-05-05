// POST /api/photos/moderate
// Body: { id: string, action: 'approve' | 'reject' }
// Approves a photo (moves storage to /approved/<cat>/<id>.jpg, sets status, optionally emails parent)
// or rejects (deletes the photo).

import { db, logRun } from '../../lib/db';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: Request) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const authEmail = req.headers.get('x-user-email');
  if (authEmail !== process.env.VALIDATOR_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, action } = body as { id: string; action: 'approve' | 'reject' };

    const { data: photo, error: getErr } = await db
      .from('gallery_pending').select('*').eq('id', id).single();
    if (getErr || !photo) return Response.json({ error: 'Photo not found' }, { status: 404 });

    if (action === 'approve') {
      // Move file to /approved/<category>/<id>.<ext>
      const ext = photo.original_path.split('.').pop();
      const newPath = `approved/${photo.category}/${id}.${ext}`;
      const { error: mvErr } = await db.storage.from('gallery').move(photo.original_path, newPath);
      if (mvErr) throw mvErr;

      // Update record (move to gallery_approved table)
      await db.from('gallery_approved').insert({
        id, category: photo.category, title: photo.title,
        path: newPath, email: photo.email,
        approved_at: new Date().toISOString(),
        approved_by: authEmail,
      });
      await db.from('gallery_pending').delete().eq('id', id);

      // Email parent
      if (photo.email) {
        await resend.emails.send({
          from: 'ESI Isigny <noreply@esi-isigny.fr>',
          to: photo.email,
          subject: `[ESI] Ta photo a été publiée 🎉`,
          html: `<p>Bonjour,</p>
            <p>Ta photo (${photo.title || photo.original_filename}) vient d'être validée et publiée dans la galerie de l'<strong>Étoile Sportive d'Isigny</strong>.</p>
            <p>Merci pour ton soutien au club !</p>
            <p>👉 <a href="${process.env.NEXT_PUBLIC_SITE_URL}/#galerie">Voir la galerie</a></p>
            <p>Allez ESI ! 🟦⚪</p>`,
        });
      }

      await logRun('photos-moderate', 'success', { action: 'approve', id });
      return Response.json({ ok: true, action: 'approved' });
    }

    if (action === 'reject') {
      await db.storage.from('gallery').remove([photo.original_path]);
      await db.from('gallery_pending').delete().eq('id', id);
      await logRun('photos-moderate', 'success', { action: 'reject', id });
      return Response.json({ ok: true, action: 'rejected' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    await logRun('photos-moderate', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
