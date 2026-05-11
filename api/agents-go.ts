// Test endpoint matching health.ts pattern exactly
export const runtime = 'edge';

export default function handler() {
  return Response.json({
    ok: true,
    where: 'agents-go',
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
