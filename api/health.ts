// GET /api/health
// Health check endpoint. The front-end pings this to detect if backend is deployed.
// If reachable → use real API; if not → fall back to IndexedDB demo mode.
export const config = { runtime: 'edge' };

export default function handler() {
  return Response.json({
    ok: true,
    service: 'esi-isigny',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
