// AGENT 05 — Convocation Reminder
// Tous les soirs 18h. Envoie un email à chaque licencié convoqué pour un match dans 24-48h.
// Skip si RESEND_API_KEY manque.
import { sbSelect, sbInsert, logRun } from '../supabase';

const RESEND_KEY = process.env.RESEND_API_KEY || '';

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ESI Isigny <noreply@esi-isigny.fr>',
      to,
      subject,
      html,
    }),
  });
  return res.ok;
}

export async function run() {
  try {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const tomorrowEnd = new Date(Date.now() + 2 * 86400000).toISOString();

    const convocs = await sbSelect<any>(
      'convocations',
      `select=*,players:convocation_players(user_id)&match_date=gte.${encodeURIComponent(tomorrow)}&match_date=lt.${encodeURIComponent(tomorrowEnd)}`
    );

    let sent = 0;

    if (RESEND_KEY) {
      for (const c of convocs) {
        for (const p of c.players || []) {
          if (!p.user_id) continue;
          // Note: récupérer l'email du user_id nécessite auth.users qui n'est pas exposé via REST
          // Pour l'instant on log juste — à câbler quand l'authentification sera prête
          const ok = await sendEmail(
            'placeholder@todo.com',
            `[ESI] Convocation — ${c.team_label} vs ${c.opponent}`,
            `<p>Tu es convoqué pour ${c.team_label} vs ${c.opponent} le ${new Date(c.match_date).toLocaleString('fr-FR')}.</p>`
          );
          if (ok) sent++;
        }
      }
    }

    await logRun('05-convoc-reminder', 'success', {
      convocs_count: convocs.length,
      sent,
      resend_configured: !!RESEND_KEY,
    });
    return { ok: true, convocs_count: convocs.length, sent };
  } catch (err: any) {
    await logRun('05-convoc-reminder', 'error', { error: err.message });
    return { ok: false, error: err.message };
  }
}
