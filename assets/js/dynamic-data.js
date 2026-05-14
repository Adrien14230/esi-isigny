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
    // HERO PILLS — remplace les 3 fix-pill du hero (top droite)
    // ============================================================
    const heroFixtures = document.querySelector('.hero-fixtures');
    if (heroFixtures && matches.upcoming && matches.upcoming.length) {
      const now = Date.now();
      const futureMatches = matches.upcoming
        .filter(m => new Date(m.date).getTime() > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 3);

      if (futureMatches.length) {
        const POOL_PATHS = {
          'Seniors A': '/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/3/accueil',
          'Seniors B': '/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/4/accueil',
          'Seniors F': '/competition/engagement/440195-seniors-f-a-8-sport-200-lequertier/phase/1/2/accueil',
          'Vétérans': '/competition/engagement/441428-championnat-veterans/phase/1/2/accueil',
          'U15 (1)': '/competition/engagement/445255-championnat-u15-d3/phase/2/2/accueil',
          'U15 (2)': '/competition/engagement/445255-championnat-u15-d3/phase/2/3/accueil',
          'U13': '/competition/engagement/445894-championnat-u13-niveau-4/phase/2/2/accueil',
        };

        const tcase = (s) => (s || '').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const extractClCod = (logoUrl) => {
          const m = (logoUrl || '').match(/\/BC?(\d{6})\.jpg/i) || (logoUrl || '').match(/(\d{6})/);
          return m ? m[1] : '501416';
        };

        const html = futureMatches.map((m, idx) => {
          const featured = idx === 0 ? ' featured' : '';
          const oppName = m.esiHome ? tcase(m.visiteur.nom) : tcase(m.recevant.nom);
          const oppClCod = extractClCod(m.esiHome ? m.visiteur.logo : m.recevant.logo);
          const compPath = POOL_PATHS[m.teamLabel] || '/';
          const teamLabelShort = m.teamLabel.replace('Seniors ', 'Seniors ');
          const ariaLabel = idx === 0 ? `Prochain match ${m.teamLabel}` : `Match ${m.teamLabel}`;
          const labelPrefix = idx === 0 ? `Prochain · ${teamLabelShort}` : teamLabelShort;
          return `
            <a href="https://epreuves.fff.fr${compPath}" target="_blank" rel="noopener" class="fix-pill${featured}" aria-label="${ariaLabel}" style="opacity:1!important;transform:none!important;">
              <div class="fix-pill-date">
                <span class="fix-pill-date-label">${labelPrefix}</span>
                <span class="fix-pill-date-value">${formatDateShort(m.date)}</span>
              </div>
              <div class="fix-pill-vs">
                <img src="assets/logos/501416.jpg" alt="ESI" class="fix-pill-logo" loading="lazy"/>
                <span class="fix-pill-vs-label">VS</span>
                <img src="assets/logos/${oppClCod}.jpg" alt="${oppName}" class="fix-pill-logo" loading="lazy" onerror="this.src='assets/logos/501416.jpg';this.style.opacity='0.3';"/>
              </div>
              <span class="fix-pill-arrow" aria-hidden="true">
                <svg viewBox="0 0 12 12"><path d="M3 6h6m-2.5-2.5L9 6 6.5 8.5" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </a>`;
        }).join('');

        heroFixtures.innerHTML = html;
        console.log(`[ESI] ✓ ${futureMatches.length} hero pills mis à jour (futurs uniquement)`);
      }
    }

    // ============================================================
    // CALENDRIER — remplace .fixtures-strip dans #calendrier
    // ============================================================
    const fixturesStrip = document.querySelector('#calendrier .fixtures-strip');
    const nowMs = Date.now();
    const upcomingFiltered = matches.upcoming
      ? matches.upcoming.filter(m => new Date(m.date).getTime() > nowMs).sort((a, b) => new Date(a.date) - new Date(b.date))
      : [];
    if (fixturesStrip && upcomingFiltered.length) {
      const upcoming = upcomingFiltered;
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
    const POOL_TO_TEAM = {
      'seniors-a': 'Seniors A',
      'seniors-b': 'Seniors B',
      'seniors-f': 'Seniors F',
      'veterans': 'Vétérans',
      'u15-1': 'U15 (1)',
      'u15-2': 'U15 (2)',
      'u13': 'U13',
    };

    // Extrait le clCod d'une URL logo FFF type ".../phlogos/BC501416.jpg" ou ".../BC527693.jpg"
    const extractClCod = (logoUrl) => {
      const m = (logoUrl || '').match(/\/BC?(\d{6})\.jpg/i) || (logoUrl || '').match(/(\d{6})/);
      return m ? m[1] : '';
    };

    // Format date court pour DERNIER MATCH (ex: "10 mai")
    const formatDateLast = (iso) => {
      const d = new Date(iso);
      const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
      return `${d.getDate()} ${months[d.getMonth()]}`;
    };
    // Format date pour PROCHAIN MATCH (ex: "Sam. 17 mai · 15h00")
    const formatDateNext = (iso) => {
      const d = new Date(iso);
      const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
      const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
      const time = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
      return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${time}`;
    };

    // Capitalize team names (FFF renvoie tout en MAJ)
    const tcase = (s) => (s || '').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    if (classements && classements.pools && window.CLASSEMENTS) {
      for (const [key, pool] of Object.entries(classements.pools)) {
        if (!window.CLASSEMENTS[key]) continue;

        // Update rows
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

        // Patch lastMatch + nextMatch depuis matches.json
        const teamLabel = POOL_TO_TEAM[key];
        if (teamLabel && matches) {
          // DERNIER MATCH
          const last = matches.played
            .filter(m => m.teamLabel === teamLabel)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          if (last) {
            const esiButs = last.esiHome ? last.recevant.buts : last.visiteur.buts;
            const oppButs = last.esiHome ? last.visiteur.buts : last.recevant.buts;
            const result = esiButs > oppButs ? 'win' : esiButs < oppButs ? 'loss' : 'draw';
            const homeName = last.esiHome ? `ESI ${teamLabel}` : tcase(last.recevant.nom);
            const awayName = last.esiHome ? tcase(last.visiteur.nom) : `ESI ${teamLabel}`;
            const homeClCod = last.esiHome ? '501416' : extractClCod(last.recevant.logo);
            const awayClCod = last.esiHome ? extractClCod(last.visiteur.logo) : '501416';
            window.CLASSEMENTS[key].lastMatch = {
              date: formatDateLast(last.date),
              home: homeName,
              away: awayName,
              score: `${last.recevant.buts}-${last.visiteur.buts}`,
              result,
              venue: last.esiHome ? 'home' : 'away',
              logoHome: homeClCod,
              logoAway: awayClCod,
            };
          }

          // PROCHAIN MATCH
          const next = matches.upcoming
            .filter(m => m.teamLabel === teamLabel)
            .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
          if (next) {
            const homeName = next.esiHome ? `ESI ${teamLabel}` : tcase(next.recevant.nom);
            const awayName = next.esiHome ? tcase(next.visiteur.nom) : `ESI ${teamLabel}`;
            const homeClCod = next.esiHome ? '501416' : extractClCod(next.recevant.logo);
            const awayClCod = next.esiHome ? extractClCod(next.visiteur.logo) : '501416';
            window.CLASSEMENTS[key].nextMatch = {
              date: formatDateNext(next.date),
              home: homeName,
              away: awayName,
              venue: next.esiHome ? 'home' : 'away',
              logoHome: homeClCod,
              logoAway: awayClCod,
            };
          }
        }
      }
      console.log(`[ESI] ✓ window.CLASSEMENTS patché (rows + lastMatch + nextMatch) pour ${Object.keys(classements.pools).length} poules`);
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

    // ============================================================
    // CHATBOT — Régénère window.CHAT_RULES depuis les données live
    // (sinon le chatbot répond avec des classements/dates obsolètes)
    // ============================================================
    if (classements && classements.pools && matches) {
      const sup = (n) => n === 1 ? '1ᵉʳ' : `${n}ᵉ`;
      const fmtNextLine = (iso) => {
        const d = new Date(iso);
        const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
        const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${hh}h${mm}`;
      };
      const formeStr = (forme) => {
        if (!forme || !forme.length) return '';
        const last3 = forme.slice(-3).join(' ');
        return ` Forme : ${last3}.`;
      };
      const oppName = (m) => (m.esiHome ? (m.visiteur && m.visiteur.nom) : (m.recevant && m.recevant.nom)) || '';
      const venueStr = (m) => m.esiHome ? 'Dom' : 'Ext';

      const now = Date.now();
      const futureByTeam = {};
      const allFuture = [];
      for (const m of matches.upcoming || []) {
        if (new Date(m.date).getTime() <= now) continue;
        allFuture.push(m);
        const k = m.teamLabel;
        if (!futureByTeam[k] || new Date(m.date) < new Date(futureByTeam[k].date)) {
          futureByTeam[k] = m;
        }
      }
      allFuture.sort((a, b) => new Date(a.date) - new Date(b.date));

      const get = (poolKey) => {
        const pool = classements.pools[poolKey];
        if (!pool || !pool.rows) return null;
        const esi = pool.rows.find(r => r.clCod === '501416' || r.team.toUpperCase().includes('ISIGNY'));
        if (!esi) return null;
        return { esi, total: pool.rows.length };
      };
      const teamAnswer = (poolKey, teamLabel, displayName) => {
        const info = get(poolKey);
        if (!info) return null;
        const { esi, total } = info;
        const next = futureByTeam[teamLabel];
        const nextStr = next
          ? ` Prochain : <strong>${fmtNextLine(next.date)} vs ${oppName(next)}</strong> (${venueStr(next)}).`
          : '';
        return `<strong>${displayName} : ${sup(esi.position)}/${total} · ${esi.pts} pts</strong> · ${esi.j}J · ${esi.g}G/${esi.n}N/${esi.p}P · ${esi.diff >= 0 ? '+' : ''}${esi.diff} diff.${formeStr(esi.forme)}${nextStr}`;
      };

      const rules = [];

      // Prochain match (top 3 futurs)
      if (allFuture.length) {
        const lines = allFuture.slice(0, 3).map(m => {
          return `<strong>${fmtNextLine(m.date)}</strong> · ${m.teamLabel} vs ${oppName(m)} (${venueStr(m)})`;
        }).join('<br>');
        rules.push({
          kw: ['prochain match', 'next match', 'prochain', 'demain', 'samedi', 'dimanche', 'match qui vient', 'agenda'],
          a: `Les <strong>prochains matchs ESI</strong> :<br>${lines}<br><a href="#calendrier">Voir le calendrier complet</a>`,
        });
      }

      // Une règle par équipe
      const teamA = teamAnswer('seniors-a', 'Seniors A', 'Seniors A');
      if (teamA) rules.push({ kw: ['seniors a', 'seniors 1', 'séniors a', 'équipe première', 'equipe premiere'], a: teamA });
      const teamB = teamAnswer('seniors-b', 'Seniors B', 'Seniors B');
      if (teamB) rules.push({ kw: ['seniors b', 'seniors 2', 'séniors b', 'réserve', 'reserve'], a: teamB });
      const teamF = teamAnswer('seniors-f', 'Seniors F', 'Seniors F');
      if (teamF) rules.push({ kw: ['seniors f', 'féminin', 'feminine', 'feminin', 'femme', 'women'], a: teamF });
      const teamV = teamAnswer('veterans', 'Vétérans', 'Vétérans');
      if (teamV) rules.push({ kw: ['vétéran', 'veteran', 'vétérans'], a: teamV });
      const teamU15a = teamAnswer('u15-1', 'U15 (1)', 'U15 (1)');
      if (teamU15a) rules.push({ kw: ['u15 (1)', 'u15 1', 'u15-1'], a: teamU15a });
      const teamU15b = teamAnswer('u15-2', 'U15 (2)', 'U15 (2) Ent. Isigny–Carentan');
      if (teamU15b) rules.push({ kw: ['u15 (2)', 'u15 2', 'u15-2', 'entente', 'carentan'], a: teamU15b });
      // U15 générique
      if (teamU15a || teamU15b) {
        const lines = [];
        if (teamU15a) lines.push(`• ${teamU15a}`);
        if (teamU15b) lines.push(`• ${teamU15b}`);
        rules.push({ kw: ['u15', 'u14', 'jeunes 15'], a: `Deux équipes U15 à l'ESI :<br>${lines.join('<br>')}<br>Demande "u15 1" ou "u15 2" pour le détail.` });
      }
      const teamU13 = teamAnswer('u13', 'U13', 'U13');
      if (teamU13) rules.push({ kw: ['u13', 'u12', 'jeunes 13'], a: teamU13 });

      // Classement global (toutes les poules)
      const genDate = classements.generated_at ? new Date(classements.generated_at) : new Date();
      const months = ['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];
      const dateStr = `${genDate.getDate()} ${months[genDate.getMonth()]}. ${genDate.getFullYear()}`;
      const summaryRows = [];
      const allPools = [
        ['seniors-a', 'Seniors A'],
        ['seniors-b', 'Seniors B'],
        ['seniors-f', 'Seniors F'],
        ['veterans', 'Vétérans'],
        ['u15-1', 'U15 (1)'],
        ['u15-2', 'U15 (2) Ent.'],
        ['u13', 'U13'],
      ];
      for (const [k, label] of allPools) {
        const info = get(k);
        if (info) summaryRows.push(`• ${label} — ${sup(info.esi.position)}/${info.total} (${info.esi.pts} pts)`);
      }
      if (summaryRows.length) {
        rules.push({
          kw: ['classement', 'rank', 'standing', 'position', 'catégorie', 'categorie'],
          a: `<strong>Classements au ${dateStr} :</strong><br>${summaryRows.join('<br>')}<br>Clique sur une équipe dans la section "Toutes nos équipes" pour voir le classement complet.`,
        });
      }

      // Règles statiques (non dépendantes du classement)
      rules.push({ kw: ['rejoindre', 'inscription', 'inscrire', 'comment faire', 'club', 'jouer'],
        a: 'Pour <strong>rejoindre l\'ESI</strong>, contacte-nous à <a href="mailto:etoilesportiveisigny@gmail.com">etoilesportiveisigny@gmail.com</a> ou viens directement au stade. Toutes catégories de U7 à Vétérans, hommes et femmes.' });
      rules.push({ kw: ['stade', 'adresse', 'où', 'venir', 'lieu', 'plan'],
        a: '<strong>Stade Municipal d\'Isigny</strong> · Impasse du Stade · 14230 Isigny-sur-Mer · Bessin, Normandie. <a href="https://www.google.com/maps?q=Stade+Municipal+Isigny-sur-Mer" target="_blank">Voir sur Maps</a>' });
      rules.push({ kw: ['entraîneur', 'entraineur', 'coach', 'staff', 'dirigeant', 'qui'],
        a: '<strong>Encadrement :</strong><br>• Seniors A : Thomas Pottier<br>• Seniors B : Adrien Goubert / Alain Piazza / Jessy Thomine<br>• U15 : Théo Castel · U13 : Evann Lecourt · U11 : Pierre Goubert · U9 : Jessy Thomine / Lionnel Lepainteur. <a href="#staff">Voir tous les dirigeants</a>' });
      rules.push({ kw: ['convocation', 'convoq', 'sélection', 'liste'],
        a: 'Les <strong>convocations</strong> sont dans la <a href="#convocations">section Convocations</a>. Liste complète des joueurs réservée aux licenciés (compte ESI requis).' });
      rules.push({ kw: ['fondé', 'histoire', 'créé', 'cree', 'année', 'ans', '1925', 'depuis quand'],
        a: 'L\'<strong>Étoile Sportive d\'Isigny</strong> a été fondée en <strong>1925</strong>. Le club a fêté ses <strong>100 ans</strong> en 2025-26. Un siècle de football amateur en Manche.' });
      rules.push({ kw: ['merci', 'thanks', 'thank you', 'super', 'cool'],
        a: 'Avec plaisir. Allez ESI.' });
      rules.push({ kw: ['bonjour', 'salut', 'hello', 'hi', 'hey', 'coucou'],
        a: 'Bonjour. Je peux te renseigner sur les matchs, classements, convocations, le club. Pose ta question.' });

      window.CHAT_RULES = rules;
      console.log(`[ESI] ✓ Chatbot : ${rules.length} règles régénérées depuis les données live`);
    }
  } catch (err) {
    console.error('[ESI] Erreur chargement données dynamiques:', err);
  }
})();
