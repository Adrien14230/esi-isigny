// GET /api/photos/list-pending
// Admin-only. Lists photos awaiting moderation. The dirigeant tab fetches this.

import { db } from '../../lib/db';

export default async function handler(req: Request) {
  // Auth check: only the validator email can list
  const authEmail = req.headers.get('x-user-email');
  if (authEmail !== process.env.VALIDATOR_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await db
    .from('gallery_pending')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Generate signed URLs for thumbnails (5 min expiration)
  const photos = await Promise.all((data || []).map(async (p) => {
    const { data: signed } = await db.storage.from('gallery')
      .createSignedUrl(p.original_path, 300);
    return { ...p, thumb_url: signed?.signedUrl };
  }));

  return Response.json({ photos });
}
