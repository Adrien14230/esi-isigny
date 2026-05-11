// GET /api/photos/list-approved?category=<key>
// Self-contained Edge function — pas d'imports relatifs.

export const runtime = 'edge';

export default async function handler(req: Request) {
  const SB_URL = process.env.SUPABASE_URL || '';
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SB_URL || !SB_KEY) return Response.json({ error: 'Supabase env missing' }, { status: 500 });

  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const query = `select=*&order=approved_at.desc&limit=60${category ? `&category=eq.${category}` : ''}`;
    const res = await fetch(`${SB_URL}/rest/v1/gallery_approved?${query}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!res.ok) return Response.json({ error: `Supabase error: ${res.status}` }, { status: 500 });
    const data = (await res.json()) as any[];

    const photos = await Promise.all(data.map(async (p) => {
      const signRes = await fetch(`${SB_URL}/storage/v1/object/sign/gallery/${p.path}`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ expiresIn: 3600 }),
      });
      let url: string | null = null;
      if (signRes.ok) {
        const { signedURL } = await signRes.json();
        if (signedURL) url = `${SB_URL}/storage/v1${signedURL}`;
      }
      return { id: p.id, category: p.category, title: p.title, url };
    }));

    return Response.json({ photos }, { headers: { 'Cache-Control': 's-maxage=300' } });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
