// Shared Supabase REST helper for Edge Runtime agents.
// Uses direct fetch (no SDK) for full Edge compatibility.

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

export interface SbResponse<T = any> {
  ok: boolean;
  status: number;
  body: T | null;
}

export async function sbFetch<T = any>(path: string, init: RequestInit = {}): Promise<SbResponse<T>> {
  if (!SB_URL || !SB_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY missing');
  }
  const headers: Record<string, string> = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'content-type': 'application/json',
    Prefer: 'return=representation',
  };
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);

  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    body: text ? (JSON.parse(text) as T) : null,
  };
}

export async function sbUpsert(table: string, row: Record<string, any>, onConflict?: string) {
  const path = onConflict ? `${table}?on_conflict=${onConflict}` : table;
  return sbFetch(path, {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(row),
  });
}

export async function sbInsert(table: string, row: Record<string, any>) {
  return sbFetch(table, { method: 'POST', body: JSON.stringify(row) });
}

export async function sbSelect<T = any>(table: string, query = ''): Promise<T[]> {
  const sep = query ? '?' : '';
  const { ok, body } = await sbFetch<T[]>(`${table}${sep}${query}`);
  return ok && body ? body : [];
}

export async function sbUpdate(table: string, query: string, patch: Record<string, any>) {
  return sbFetch(`${table}?${query}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// Standardized run logging — every agent calls this at end
export async function logRun(agentId: string, status: 'success' | 'error', meta: any = {}) {
  await sbInsert('agent_runs', {
    agent_id: agentId,
    status,
    meta,
    ran_at: new Date().toISOString(),
  });
}

// Storage helper — upload buffer/blob to Supabase Storage bucket
export async function sbStorageUpload(bucket: string, path: string, body: BodyInit, contentType: string) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'content-type': contentType,
      'x-upsert': 'true',
    },
    body,
  });
  return { ok: res.ok, status: res.status };
}
