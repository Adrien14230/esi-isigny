// _shared/db.ts
// Supabase client. Used to persist matches, classements, convocations,
// agent run history. See README for the schema.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
export const db = createClient(url, key);

export async function logRun(agentId: string, status: 'success' | 'error', meta: any = {}) {
  await db.from('agent_runs').insert({ agent_id: agentId, status, meta, ran_at: new Date().toISOString() });
}
