// Auto-injection des données FFF scrapées par GitHub Actions
// Lit assets/data/matches.json + stats.json et met à jour les sections du site.

(async function loadDynamicData() {
  try {
    const [matchesRes, statsRes, classRes] = await Promise.all([
      fetch('/assets/data/matches.json', { cache: 'no-store' }),
      fetch('/assets/data/stats.json', { cache: 'no-store' }),
      fetch('/assets/data/classements.json', { cache: 'no-store' }),
    ]);
    if (!matchesRes.ok) {
      console.warn('[ESI] matches.json indisponible, garde le contenu statique');
      return;
    }
    const matches = await matchesRes.json();
    const stats = statsRes.ok ? await statsRes.json() : null;
    const classements = classRes.ok ? await classRes.json() : null;

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
          <div class="result-row ${verdict}" style="opacity:1!important;transform:none!important;display:flex;">
            <div class="result-indicator">${letter}</div>
            <div class="result-teams">${teamsLine}
              <span class="result-competition">${dateShort} · ${m.competition} · ${where}</span>
            </div>
            <div class="result-score">${score}</div>
          </div>`;
      }).join('');
      console.log('[ESI DEBUG] played:', played.length, 'html length:', html.length, 'first 200 chars:', html.slice(0, 200));

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
          <div class="fixture${featured}" style="opacity:1!important;transform:none!important;">
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
    // MODAL CLASSEMENT — patch window.CLASSEMENTS pour que la modal
    // affiche les vraies données quand l'utilisateur clique sur une équipe
    // ============================================================
    if (classements && classements.pools && window.CLASSEMENTS) {
      for (const [key, pool] of Object.entries(classements.pools)) {
        if (window.CLASSEMENTS[key]) {
          window.CLASSEMENTS[key].rows = pool.rows.map(r => ({
            pos: r.position,
            team: r.team,
            pts: r.pts,
            j: r.j,
            g: r.g,
            n: r.n,
            p: r.p,
            bp: r.bp,
            bc: r.bc,
            diff: r.diff,
            esi: r.clCod === '501416',
          }));
          // Update subtitle date
          if (classements.generated_at) {
            const d = new Date(classements.generated_at);
            const dateStr = `${d.getDate()} ${['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'][d.getMonth()]}. ${d.getFullYear()}`;
            window.CLASSEMENTS[key].subtitle = window.CLASSEMENTS[key].subtitle.replace(/Mis à jour [^·]*$/, `Mis à jour ${dateStr}`);
          }
        }
      }
      console.log(`[ESI] ✓ window.CLASSEMENTS patché avec ${Object.keys(classements.pools).length} poules`);
    }

    // ============================================================
    // CLASSEMENTS — Met à jour chaque team-card[data-classement]
    // ============================================================
    if (classements && classements.pools) {
      const ordinal = (n) => n === 1 ? '1<sup>er</sup>' : `${n}<sup>e</sup>`;
      document.querySelectorAll('[data-classement]').forEach(card => {
        const poolKey = card.getAttribute('data-classement');
        const pool = classements.pools[poolKey];
        if (!pool || !pool.rows) return;
        // Trouver l'entrée ESI dans le classement
        const esi = pool.rows.find(r => r.clCod === '501416' || r.team.toUpperCase().includes('ISIGNY'));
        if (!esi) return;

        // Update position + meta
        const posEl = card.querySelector('.team-card-rank-pos');
        const rankEl = card.querySelector('.team-card-rank');
        const metaEl = card.querySelector('.team-card-rank-meta');
        if (posEl) {
          posEl.innerHTML = ordinal(esi.position);
          // Couleur selon la position
          const total = pool.rows.length;
          const isTop = esi.position <= 3;
          const isMid = esi.position <= Math.ceil(total / 2);
          const color = isTop ? 'var(--win)' : isMid ? 'var(--draw)' : 'var(--loss)';
          posEl.style.color = color;
          // Background subtil sur l'encadré rank
          if (rankEl) {
            const bgColor = isTop ? 'rgba(34,197,94,0.10)' : isMid ? 'rgba(148,163,184,0.10)' : 'rgba(239,68,68,0.08)';
            rankEl.style.background = bgColor;
          }
        }
        if (metaEl) {
          metaEl.textContent = `/ ${pool.rows.length} · ${esi.pts} pts`;
        }
        // Reset les styles inline de fond du bouton (cas U15 ex-or)
        card.style.background = '';
        card.style.borderColor = '';
        // Reset le label "1er du classement" si pas 1er
        const catEl = card.querySelector('.team-card-cat');
        if (catEl) {
          catEl.style.color = '';
          catEl.style.fontWeight = '';
        }

        // Update les W/D/L stats
        const compEl = card.querySelector('.team-card-comp');
        if (compEl) {
          const fr = compEl.querySelector('[data-lang="fr"]');
          const en = compEl.querySelector('[data-lang="en"]');
          if (fr) fr.textContent = `${esi.j} J · ${esi.g} G · ${esi.n} N · ${esi.p} P · ${esi.diff >= 0 ? '+' : ''}${esi.diff} diff.`;
          if (en) en.textContent = `${esi.j} P · ${esi.g} W · ${esi.n} D · ${esi.p} L · ${esi.diff >= 0 ? '+' : ''}${esi.diff} diff.`;
        }

        // Update les 3-5 derniers résultats (forme)
        if (esi.forme && esi.forme.length) {
          const dots = card.querySelectorAll('.dot-mini');
          const last3 = esi.forme.slice(-3);
          dots.forEach((dot, idx) => {
            const r = last3[idx];
            if (r) {
              dot.textContent = r === 'V' ? 'V' : r === 'D' ? 'D' : r === 'N' ? 'N' : r;
              dot.className = `dot-mini ${r === 'V' ? 'W' : r === 'D' ? 'L' : 'D'}`;
            }
          });
        }
      });
      console.log(`[ESI] ✓ Classements injectés pour ${Object.keys(classements.pools).length} poules`);
    }

    // ============================================================
    // PAGE ÉQUIPE — si on est sur seniors-a.html, seniors-b.html, etc.
    // ============================================================
    const pathname = window.location.pathname;
    const teamPageMatch = pathname.match(/\/(seniors-a|seniors-b|seniors-f|veterans|u15-1|u15-2|u13|u11|u9)\.html$/);
    if (teamPageMatch && classements && classements.pools) {
      const poolKey = teamPageMatch[1];
      const pool = classements.pools[poolKey];
      if (pool && pool.rows) {
        const esi = pool.rows.find(r => r.clCod === '501416' || r.team.toUpperCase().includes('ISIGNY'));
        if (esi) {
          const ordinal = (n) => n === 1 ? '1<sup>er</sup>' : `${n}<sup>e</sup>`;
          // .team-page-rank
          const rankBox = document.querySelector('.team-page-rank');
          const posEl = document.querySelector('.team-page-rank-pos');
          const metaEl = document.querySelector('.team-page-rank-meta');
          if (posEl) {
            posEl.innerHTML = ordinal(esi.position);
            const isTop = esi.position <= 3;
            const isMid = esi.position <= Math.ceil(pool.rows.length / 2);
            const color = isTop ? 'var(--win)' : isMid ? 'var(--draw)' : 'var(--loss)';
            posEl.style.color = color;
            if (rankBox) {
              rankBox.style.background = isTop ? 'rgba(34,197,94,0.10)' : isMid ? 'rgba(148,163,184,0.10)' : 'rgba(239,68,68,0.08)';
            }
          }
          if (metaEl) metaEl.textContent = `/ ${pool.rows.length} · ${esi.pts} pts`;

          // .team-page-stats — J, G, N, P, BP, BC, Diff
          const cells = document.querySelectorAll('.team-page-stats .stat-cell strong');
          if (cells.length >= 7) {
            cells[0].textContent = esi.j;
            cells[1].textContent = esi.g;
            cells[2].textContent = esi.n;
            cells[3].textContent = esi.p;
            cells[4].textContent = esi.bp;
            cells[5].textContent = esi.bc;
            cells[6].textContent = `${esi.diff >= 0 ? '+' : ''}${esi.diff}`;
          }

          // Forme récente — last 5 results
          if (esi.forme && esi.forme.length) {
            const dotsContainer = document.querySelector('.team-info-card .dot-mini')?.parentElement;
            if (dotsContainer) {
              const last5 = esi.forme.slice(-5);
              const dotsHtml = last5.map(r => {
                const bg = r === 'V' ? '#22C55E' : r === 'D' ? '#EF4444' : '#94A3B8';
                const letter = r === 'V' ? 'V' : r === 'D' ? 'D' : 'N';
                return `<span class="dot-mini" style="background:${bg};color:#fff;">${letter}</span>`;
              }).join('');
              const ancientNote = dotsContainer.querySelector('span:not(.dot-mini)');
              dotsContainer.innerHTML = dotsHtml + (ancientNote ? ancientNote.outerHTML : '<span style="color:var(--draw);font-size:13px;margin-left:12px;">Du plus ancien au plus récent</span>');
            }
          }

          console.log(`[ESI] ✓ Page ${poolKey} mise à jour : ${esi.position}e, ${esi.pts} pts`);
        }
      }

      // Mettre aussi à jour le prochain match sur la page équipe
      if (matches.upcoming) {
        const next = matches.upcoming
          .filter(m => poolKey === 'seniors-a' ? m.teamLabel === 'Seniors A'
                     : poolKey === 'seniors-b' ? m.teamLabel === 'Seniors B'
                     : poolKey === 'seniors-f' ? m.teamLabel === 'Seniors F'
                     : poolKey === 'veterans' ? m.teamLabel === 'Vétérans'
                     : poolKey === 'u15-1' ? m.teamLabel === 'U15 (1)'
                     : poolKey === 'u15-2' ? m.teamLabel === 'U15 (2)'
                     : poolKey === 'u13' ? m.teamLabel === 'U13'
                     : false)
          .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

        if (next) {
          const nextMatchCard = Array.from(document.querySelectorAll('.team-info-card h3'))
            .find(h => h.textContent.trim() === 'Match prévu')?.parentElement;
          if (nextMatchCard) {
            const oppName = next.esiHome ? next.visiteur.nom : next.recevant.nom;
            const dateStr = formatDateShort(next.date);
            const timeStr = formatTime(next.date);
            const venue = next.esiHome ? 'Domicile' : 'Extérieur';
            const p = nextMatchCard.querySelector('p');
            if (p) p.innerHTML = `<strong>${dateStr} ${timeStr} vs ${oppName} (${venue})</strong>`;
          }
        }
      }
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
