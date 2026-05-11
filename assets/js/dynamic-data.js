// Auto-injection des données FFF scrapées par GitHub Actions
// Lit assets/data/matches.json + stats.json et met à jour les sections du site.

(async function loadDynamicData() {
  try {
    const [matchesRes, statsRes] = await Promise.all([
      fetch('/assets/data/matches.json', { cache: 'no-store' }),
      fetch('/assets/data/stats.json', { cache: 'no-store' }),
    ]);
    if (!matchesRes.ok) {
      console.warn('[ESI] matches.json indisponible, garde le contenu statique');
      return;
    }
    const matches = await matchesRes.json();
    const stats = statsRes.ok ? await statsRes.json() : null;

    // Format une date FR : "Dim. 10 mai"
    const formatDateShort = (iso) => {
      const d = new Date(iso);
      const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
      const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
      return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
    };
    const formatTime = (iso) => {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
    };

    // ============================================================
    // RÉSULTATS — remplace .results-list dans #resultats
    // ============================================================
    const resultsList = document.querySelector('#resultats .results-list');
    if (resultsList && matches.played && matches.played.length) {
      // Trier par date desc (le plus récent en premier)
      const played = [...matches.played].sort((a, b) => new Date(b.date) - new Date(a.date));

      const html = played.slice(0, 10).map(m => {
        const esiButs = m.esiHome ? m.recevant.buts : m.visiteur.buts;
        const oppButs = m.esiHome ? m.visiteur.buts : m.recevant.buts;
        const verdict = esiButs > oppButs ? 'win' : esiButs < oppButs ? 'loss' : 'draw';
        const letter = verdict === 'win' ? 'V' : verdict === 'loss' ? 'D' : 'N';
        const oppName = m.esiHome ? m.visiteur.nom : m.recevant.nom;
        const teamsLine = m.esiHome
          ? `ESI ${m.teamLabel} — ${oppName}`
          : `${oppName} — ESI ${m.teamLabel}`;
        const score = m.esiHome
          ? `${m.recevant.buts ?? '?'} - ${m.visiteur.buts ?? '?'}`
          : `${m.visiteur.buts ?? '?'} - ${m.recevant.buts ?? '?'}`;
        const dateShort = formatDateShort(m.date);
        const where = m.esiHome ? 'Domicile' : 'Extérieur';
        return `
          <div class="result-row ${verdict} reveal">
            <div class="result-indicator">${letter}</div>
            <div class="result-teams">${teamsLine}
              <span class="result-competition">${dateShort} · ${m.competition} · ${where}</span>
            </div>
            <div class="result-score">${score}</div>
          </div>`;
      }).join('');

      resultsList.innerHTML = html;
      console.log(`[ESI] ✓ ${played.length} résultats chargés depuis FFF`);

      // Mets à jour la date "Mis à jour" si trouvée
      const updateLabel = document.querySelector('#resultats .section-eyebrow [data-lang="fr"]');
      if (updateLabel && matches.generated_at) {
        const updated = new Date(matches.generated_at);
        const d = `${updated.getDate()} ${['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'][updated.getMonth()]}. ${updated.getFullYear()}`;
        updateLabel.textContent = `Mis à jour ${d} · Données FFF`;
      }
    }

    // ============================================================
    // CALENDRIER — remplace .fixtures-strip dans #calendrier
    // ============================================================
    const fixturesStrip = document.querySelector('#calendrier .fixtures-strip');
    if (fixturesStrip && matches.upcoming && matches.upcoming.length) {
      const upcoming = [...matches.upcoming].sort((a, b) => new Date(a.date) - new Date(b.date));
      const featuredTeams = ['Seniors A', 'Seniors F'];

      const html = upcoming.slice(0, 8).map(m => {
        const featured = featuredTeams.includes(m.teamLabel) ? ' featured' : '';
        const oppName = m.esiHome ? m.visiteur.nom : m.recevant.nom;
        const oppLogo = m.esiHome ? m.visiteur.logo : m.recevant.logo;
        const esiLogo = 'assets/logos/501416.jpg';
        const where = m.esiHome ? 'home' : 'away';
        const whereLabel = m.esiHome ? 'Dom.' : 'Ext.';
        const teams = m.esiHome
          ? `ESI ${m.teamLabel} <span class="vs-mini" style="margin:0 6px;">·</span> ${oppName}`
          : `${oppName} <span class="vs-mini" style="margin:0 6px;">·</span> ESI ${m.teamLabel}`;
        const logos = m.esiHome
          ? `<img src="${esiLogo}" alt="ESI" class="fixture-logo" loading="lazy"/><span class="fixture-vs">VS</span><img src="${oppLogo || esiLogo}" alt="${oppName}" class="fixture-logo" loading="lazy"/>`
          : `<img src="${oppLogo || esiLogo}" alt="${oppName}" class="fixture-logo" loading="lazy"/><span class="fixture-vs">VS</span><img src="${esiLogo}" alt="ESI" class="fixture-logo" loading="lazy"/>`;
        const dateLabel = formatDateShort(m.date);
        const timeLabel = formatTime(m.date);

        return `
          <div class="fixture${featured}">
            <div class="fixture-head">
              <span class="fixture-comp">${m.teamLabel} · ${m.competition}</span>
              <span class="fixture-loc ${where}">${whereLabel}</span>
            </div>
            <div class="fixture-logos">${logos}</div>
            <div class="fixture-teams" style="font-size:13px;text-align:center;">${teams}</div>
            <div class="fixture-meta">
              <span class="fixture-date">${dateLabel}</span>
              <span class="fixture-time">${timeLabel}</span>
            </div>
          </div>`;
      }).join('');

      fixturesStrip.innerHTML = html;
      console.log(`[ESI] ✓ ${upcoming.length} matchs à venir chargés`);
    }

    // ============================================================
    // STATS — Met à jour les compteurs si stats.json disponible
    // ============================================================
    if (stats && stats.per_team) {
      let totalPlayed = 0, totalWins = 0;
      for (const t of Object.values(stats.per_team)) {
        totalPlayed += t.played || 0;
        totalWins += t.wins || 0;
      }
      console.log(`[ESI] Stats club: ${totalPlayed} matchs joués, ${totalWins} victoires`);
    }
  } catch (err) {
    console.error('[ESI] Erreur chargement données dynamiques:', err);
  }
})();
