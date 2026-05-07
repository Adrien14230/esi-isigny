// AGENT 05 — Convocation Reminder
// Runs every day at 18:00. Sends an email/push to each licencié convoked
// for a match in the next 24-48h (so Friday for Saturday, Saturday for Sunday).

import { db, logRun } from '../../lib/db.js';
import { Resend } from 'resend';

export const config = { runtime: 'edge' };

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler() {
  try {
    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowEnd = new Date(Date.now() + 2 * 86400000);

    const { data: convocs } = await db
      .from('convocations')
      .select('*, fixtures(*), players:convocation_players(user:users(*))')
      .gte('match_date', tomorrow.toISOString())
      .lt('match_date', tomorrowEnd.toISOString());

    let sent = 0;
    for (const c of convocs || []) {
      for (const p of c.players || []) {
        if (!p.user?.email) continue;
        await resend.emails.send({
          from: 'ESI Isigny <noreply@esi-isigny.fr>',
          to: p.user.email,
          subject: `[ESI] Convocation — ${c.team_label} ${c.opponent}`,
          html: `<h2>Bonjour ${p.user.name},</h2>
            <p>Tu es convoqué pour le match :</p>
            <ul>
              <li><strong>${c.team_label}</strong> vs ${c.opponent}</li>
              <li>📅 ${new Date(c.match_date).toLocaleString('fr-FR')}</li>
              <li>📍 ${c.venue === 'home' ? 'Domicile · Stade Municipal' : 'Extérieur'}</li>
              <li>⏰ Convocation : <strong>${c.call_time}</strong></li>
            </ul>
            <p>Maillot : ${c.kit_color || 'à confirmer'}</p>
            <p>Allez ESI ! 🟦⚪</p>`,
        });
        sent++;
      }
    }

    await logRun('05-convoc-reminder', 'success', { sent });
    return Response.json({ ok: true, sent });
  } catch (err: any) {
    await logRun('05-convoc-reminder', 'error', { error: err.message });
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

