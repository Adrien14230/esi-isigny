// GET /api/test-supabase
// Diagnostic: imports Supabase mais ne fait rien d'autre.
// Si ça crash, le souci est avec le package @supabase/supabase-js sur Edge Runtime.
// Si ça marche, le souci est ailleurs (resend, fff, etc.).

import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export default async function handler() {
  try {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_KEY || '';

    return Response.json({
      ok: true,
      has_url: !!url,
      has_key: !!key,
      url_starts_with: url.slice(0, 30),
      key_length: key.length,
      can_create_client: typeof createClient === 'function',
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message, stack: err.stack?.slice(0, 500) }, { status: 500 });
  }
}
