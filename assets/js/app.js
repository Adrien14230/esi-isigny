// --- Nav scroll behavior ---
const nav = document.getElementById('main-nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
}, { passive: true });

// --- Burger fullscreen menu ---
const hamburger = document.getElementById('hamburger');
const burgerOverlay = document.getElementById('burgerOverlay');
const burgerClose = document.getElementById('burgerClose');

function openBurger() {
  hamburger.classList.add('open');
  burgerOverlay.classList.add('open');
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.setAttribute('aria-label', 'Fermer le menu de navigation');
  document.body.style.overflow = 'hidden';
  // Focus le bouton close pour la nav clavier
  setTimeout(() => burgerClose && burgerClose.focus(), 50);
}
function closeBurger() {
  hamburger.classList.remove('open');
  burgerOverlay.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Ouvrir le menu de navigation');
  document.body.style.overflow = '';
  // Rend le focus au hamburger pour ne pas perdre la position clavier
  hamburger.focus();
}
function closeMobileMenu() { closeBurger(); }  // Backwards-compat alias
// Expose globalement pour que les onclick="closeBurger()" inline fonctionnent quoi qu'il arrive
window.closeBurger = closeBurger;
window.openBurger = openBurger;

hamburger.addEventListener('click', () => {
  if (burgerOverlay.classList.contains('open')) closeBurger();
  else openBurger();
});
burgerClose.addEventListener('click', closeBurger);

// Close on backdrop click (clicking outside the panel)
burgerOverlay.addEventListener('click', (e) => {
  if (e.target === burgerOverlay) closeBurger();
});

// Close on link click (with small delay so smooth-scroll triggers first)
burgerOverlay.querySelectorAll('[data-burger-link]').forEach(link => {
  link.addEventListener('click', () => setTimeout(closeBurger, 80));
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && burgerOverlay.classList.contains('open')) closeBurger();
});

// --- Language toggle ---
const langBtn = document.getElementById('lang-btn');
let currentLang = 'fr';
langBtn.addEventListener('click', () => {
  if (currentLang === 'fr') {
    currentLang = 'en';
    document.body.classList.add('en');
    langBtn.textContent = 'FR';
    document.documentElement.lang = 'en';
  } else {
    currentLang = 'fr';
    document.body.classList.remove('en');
    langBtn.textContent = 'EN';
    document.documentElement.lang = 'fr';
  }
});

// --- Scroll reveal ---
// Stagger uniquement entre frères immédiats (sinon les sections en bas se voient
// attribuer un idx énorme et mettent plusieurs secondes à apparaître)
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      // Compte uniquement les .reveal qui sont DIRECTEMENT enfants du même parent
      const directSiblings = [...entry.target.parentElement.children].filter(el => el.classList.contains('reveal'));
      const idx = directSiblings.indexOf(entry.target);
      // Cap à 240ms max pour ne jamais avoir de délai trop long
      const delay = Math.min(idx * 60, 240);
      setTimeout(() => entry.target.classList.add('visible'), delay);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
reveals.forEach(el => observer.observe(el));

// =================================================================
// PHOTOS APPROUVÉES — "Récemment partagées" dans la galerie
// =================================================================
async function refreshRecentUploads() {
  const block = document.getElementById('recentUploads');
  const grid = document.getElementById('recentUploadsGrid');
  const counter = document.getElementById('recentUploadsCount');
  if (!block || !grid) return;
  const photos = await PhotosDB.list('approved');
  if (photos.length === 0) {
    block.style.display = 'none';
    return;
  }
  block.style.display = 'block';
  counter.textContent = photos.length + ' ' + (photos.length === 1 ? 'photo' : 'photos');
  grid.innerHTML = photos.slice(0, 20).map(p => `
    <div style="position:relative;aspect-ratio:1/1;border-radius:8px;overflow:hidden;cursor:pointer;background:rgba(255,255,255,0.04);" data-recent-id="${p.id}">
      <img src="${p.dataUrl}" alt="${p.title || ''}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform 0.3s;">
      <div style="position:absolute;bottom:0;left:0;right:0;padding:8px 10px;background:linear-gradient(transparent,rgba(0,0,0,0.85));color:#fff;">
        <div style="font-family:var(--font-display);font-weight:700;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">
          ${CAT_LABEL[p.category] || p.category}
        </div>
        ${p.title ? `<div style="font-family:var(--font-display);font-weight:700;font-size:11px;line-height:1.2;margin-top:2px;">${p.title}</div>` : ''}
      </div>
    </div>
  `).join('');
}
window.refreshRecentUploads = refreshRecentUploads;
window.addEventListener('load', () => setTimeout(refreshRecentUploads, 600));

document.getElementById('modRefresh')?.addEventListener('click', () => {/* removed */});


// =================================================================
// PHOTO UPLOAD — full flow (IndexedDB demo mode + API production mode)
// =================================================================

// IndexedDB wrapper for offline/demo persistence.
// In production with /api/upload-photo deployed, the API is preferred.
const PhotosDB = (() => {
  const DB = 'esi-photos';
  const STORE = 'photos';
  let dbp;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('cat', 'category', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      const result = fn(store);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  return {
    async addPhoto({ category, title, file }) {
      const dataUrl = await fileToDataURL(file);
      const photo = {
        id: 'photo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        category, title: title || '',
        filename: file.name,
        size: file.size,
        dataUrl,
        status: 'approved',  // direct publication — confiance aux parents
        createdAt: Date.now(),
      };
      await tx('readwrite', s => s.add(photo));
      return photo;
    },
    async list(status) {
      return tx('readonly', store => new Promise(res => {
        const result = [];
        const idx = status ? store.index('status') : store;
        const range = status ? IDBKeyRange.only(status) : null;
        const req = (status ? idx.openCursor(range) : idx.openCursor());
        req.onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) { result.push(cursor.value); cursor.continue(); }
          else res(result.sort((a, b) => b.createdAt - a.createdAt));
        };
      }));
    },
    async setStatus(id, status) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const s = t.objectStore(STORE);
        const get = s.get(id);
        get.onsuccess = () => {
          const p = get.result;
          if (!p) return resolve(false);
          p.status = status;
          p.moderatedAt = Date.now();
          s.put(p);
        };
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    },
    async remove(id) {
      return tx('readwrite', s => s.delete(id));
    },
    async count(status) {
      return tx('readonly', store => new Promise(res => {
        if (!status) { const r = store.count(); r.onsuccess = () => res(r.result); return; }
        const idx = store.index('status');
        const r = idx.count(IDBKeyRange.only(status));
        r.onsuccess = () => res(r.result);
      }));
    }
  };
})();

const CAT_LABEL = {
  'seniors-a': 'Seniors A',
  'seniors-b': 'Seniors B',
  'seniors-f': 'Seniors F',
  'veterans': 'Vétérans',
  'u15-1': 'U15 (1)',
  'u15-2': 'U15 (2) Ent.',
  'u13': 'U13',
  'u11': 'U11',
  'u9': 'U9',
  'club': 'Vie du club',
};

// --- Photo upload form (parents) ---
(function setupUpload() {
  const form = document.getElementById('uploadForm');
  if (!form) return;

  const drop = document.getElementById('upDrop');
  const input = document.getElementById('upFiles');
  const preview = document.getElementById('upPreview');
  const success = document.getElementById('upSuccess');
  const errorEl = document.getElementById('upError');
  const submit = document.getElementById('upSubmit');

  let files = [];
  const MAX = 10;

  function renderPreview() {
    preview.innerHTML = '';
    files.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'upload-preview-item';
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'upload-preview-remove';
      btn.innerHTML = '×';
      btn.setAttribute('aria-label', 'Retirer');
      btn.addEventListener('click', () => {
        files.splice(idx, 1);
        renderPreview();
      });
      item.appendChild(img);
      item.appendChild(btn);
      preview.appendChild(item);
    });
  }

  function addFiles(newFiles) {
    const arr = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    files = [...files, ...arr].slice(0, MAX);
    renderPreview();
  }

  // Click to open file picker (input is hidden but covers dropzone)
  input.addEventListener('change', e => addFiles(e.target.files));

  // Drag & drop
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('drag');
  }));
  drop.addEventListener('drop', e => {
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  });

  // Submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    success.classList.remove('show');
    errorEl.classList.remove('show');

    const cat = document.getElementById('upCat').value;
    const consent = document.getElementById('upConsent').checked;
    if (!cat || files.length === 0 || !consent) {
      errorEl.classList.add('show');
      return;
    }

    submit.disabled = true;
    submit.innerHTML = '<span>Envoi en cours…</span>';
    const title = document.getElementById('upTitle').value;

    try {
      // Try production API first, fall back to local IndexedDB if unavailable
      let useApi = false;
      try {
        const r = await fetch('/api/health', { method: 'GET', signal: AbortSignal.timeout(800) });
        useApi = r.ok;
      } catch (_) { useApi = false; }

      if (useApi) {
        // Production: POST FormData to backend (Vercel function + Supabase Storage)
        const fd = new FormData();
        fd.append('category', cat);
        fd.append('title', title);
        files.forEach(f => fd.append('photos', f));
        const r = await fetch('/api/upload-photo', { method: 'POST', body: fd });
        if (!r.ok) throw new Error('Upload failed');
      } else {
        // Local demo: persist into IndexedDB
        for (const file of files) {
          await PhotosDB.addPhoto({ category: cat, title, file });
        }
      }

      // Reset form
      form.reset();
      files = [];
      renderPreview();
      success.classList.add('show');
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => success.classList.remove('show'), 8000);

      // Refresh "Récemment partagées" gallery row
      if (window.refreshRecentUploads) window.refreshRecentUploads();
    } catch (err) {
      errorEl.classList.add('show');
      errorEl.textContent = 'Erreur lors de l\'envoi. Réessaie ou écris-nous à etoilesportiveisigny@gmail.com';
    } finally {
      submit.disabled = false;
      submit.innerHTML = '<span data-lang="fr">Publier mes photos</span><span data-lang="en">Publish my photos</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12m-4-4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
  });
})();

// --- Hero slideshow : photos ESI en fond, crossfade Ken Burns ---
(async function setupHeroSlideshow() {
  const bg = document.getElementById('heroBg');
  if (!bg) return;

  const NB_HERO = 5;        // nombre de photos à pré-charger
  const INTERVAL = 6500;    // ms entre chaque photo

  // Photos manuelles prioritaires (les meilleures pour fond hero)
  const curated = [
    'assets/team-bg.jpg',
  ];

  // Complète avec des photos aléatoires de la galerie
  let pool = [...curated];
  try {
    const res = await fetch('assets/gallery/manifest.json', { cache: 'no-store' });
    if (res.ok) {
      const manifest = await res.json();
      const all = [];
      Object.entries(manifest).forEach(([folder, files]) => {
        files.forEach(f => all.push('assets/gallery/' + folder + '/medium/' + f));
      });
      // Shuffle
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      pool = pool.concat(all.slice(0, NB_HERO * 2)); // marge pour préchargement
    }
  } catch (err) {
    console.warn('[hero] manifest non chargé', err);
  }

  // Garde max NB_HERO photos
  pool = pool.slice(0, NB_HERO);
  if (pool.length < 2) return; // pas la peine de slideshow avec une seule photo

  // Crée les slides (la 1ère existe déjà avec team-bg.jpg)
  bg.innerHTML = '';
  pool.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-bg-slide' + (i === 0 ? ' active' : '');
    slide.style.backgroundImage = `url('${src}')`;
    bg.appendChild(slide);
    // Préchargement
    const preload = new Image();
    preload.src = src;
  });

  const slides = bg.querySelectorAll('.hero-bg-slide');
  let current = 0;
  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, INTERVAL);
})();

// --- Marquee partenaires : bande défilante avec logos partenaires entre les sections ---
(function setupPartnersMarquee() {
  // Sections où on insère la marquee EN AMONT
  // Note: 'convocations' retiré car la section est auth-gated → sa marquee laissait 2 bandes collées quand non-connecté
  const targets = ['histoire', 'calendrier', 'resultats', 'galerie', 'staff', 'boutique'];

  // Logos des partenaires (sponsor maillot, équipementier, institutions, locaux)
  // url = site officiel si connu (ouvre dans nouvel onglet) ; sinon logo non-cliquable (juste affiché)
  const partners = [
    { src: 'assets/partners/rigault.png',               alt: 'Rigault — Sponsor maillot',     url: 'https://www.maconnerie-rigault.fr/' },
    { src: 'assets/partners/sport-2000.png',            alt: 'Sport 2000 — Équipementier',    url: 'https://www.sport2000.fr/magasin/sport-2000-carentan' },
    { src: 'assets/partners/coope-isigny.svg',          alt: 'Coopé Isigny Sainte-Mère',      url: 'https://www.isigny-ste-mere.com/' },
    { src: 'assets/partners/mairie-isigny.png',         alt: 'Mairie d’Isigny-sur-Mer',       url: 'https://www.isigny-sur-mer.fr/' },
    { src: 'assets/partners/garage-marie.png',          alt: 'Garage Marie' },
    { src: 'assets/partners/district-manche.png',       alt: 'District Manche',                url: 'https://manche.fff.fr/' },
    { src: 'assets/partners/huitres-boloch.jpeg',       alt: 'Huîtres Boloch · Maison Boloch', url: 'https://www.facebook.com/MaisonBoloch/' },
    { src: 'assets/partners/le-central.jpeg',           alt: 'Le Central',                      url: 'https://www.lecentralisigny.fr/' },
    { src: 'assets/partners/croute-doree.jpeg',         alt: 'La Croûte Dorée',                 url: 'https://www.facebook.com/p/La-Cro%C3%BBte-Dor%C3%A9e-Tanquerel-Et-Fils-100054566015001/' },
    { src: 'assets/partners/fff.png',                   alt: 'Fédération Française de Football', url: 'https://www.fff.fr/' },
    { src: 'assets/partners/sebastien-sollier.jpg',     alt: 'Menuiserie Sébastien Sollier' },
    { src: 'assets/partners/au-fournil-isigny.png',     alt: 'Au Fournil d’Isigny' },
    { src: 'assets/partners/le-versailles.png?v=4',     alt: 'Le Versailles',                   url: 'https://www.facebook.com/people/Le-Versailles/100083436696466/' },
    { src: 'assets/partners/emrg.jpeg',                 alt: 'EMRG Menuiserie',                 url: 'https://www.facebook.com/p/EMRG-Menuiserie-100092828254815/' },
    { src: 'assets/partners/olivier-menard.jpg',        alt: 'Olivier Ménard Terrassement',     url: 'https://www.menard-terrassements.fr/' },
    { src: 'assets/partners/design-hair.png?v=4',       alt: 'Design’Hair',                     url: 'https://www.fresha.com/fr/lvp/designhair-rue-emile-demagny-isigny-sur-mer-6NQ52e' },
    { src: 'assets/partners/isigny-loisirs.png',        alt: 'Isigny Loisirs' },
    { src: 'assets/partners/vincent-le-canu.webp',      alt: 'Vincent Le Canu',                 url: 'https://www.facebook.com/p/Le-canu-Vincent-couverture-100052710940111/' },
    { src: 'assets/partners/boucherie-isigny.png?v=2',  alt: 'Boucherie d’Isigny' },
    { src: 'assets/partners/carrefour.svg',             alt: 'Carrefour',                      url: 'https://www.carrefour.fr/' },
    { src: 'assets/partners/amarre-conseil.png?v=2',    alt: 'Amarre Conseil' },
  ];

  function buildLogo(p) {
    // Si site officiel connu → <a> cliquable target=_blank ; sinon <div> non-cliquable
    const el = p.url
      ? document.createElement('a')
      : document.createElement('div');
    if (p.url) {
      el.href = p.url;
      el.target = '_blank';
      el.rel = 'noopener';
      el.setAttribute('aria-label', p.alt);
    } else {
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', p.alt);
      el.style.cursor = 'default';
    }
    el.className = 'divider-marquee-logo';
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.alt;
    img.loading = 'lazy';
    el.appendChild(img);
    return el;
  }

  function buildMarquee() {
    const wrap = document.createElement('div');
    wrap.className = 'divider-marquee';
    wrap.setAttribute('aria-label', 'Partenaires de l’ESI');

    // Le label devient un simple span (plus de section #partenaires à scroller)
    const label = document.createElement('span');
    label.className = 'divider-marquee-label';
    label.textContent = 'Nos partenaires';
    wrap.appendChild(label);

    const track = document.createElement('div');
    track.className = 'divider-marquee-track';
    // Double pass pour boucle seamless (animation translate -50%)
    for (let pass = 0; pass < 2; pass++) {
      partners.forEach(p => track.appendChild(buildLogo(p)));
    }
    wrap.appendChild(track);
    return wrap;
  }

  targets.forEach(id => {
    const section = document.getElementById(id);
    if (!section || !section.parentNode) return;
    section.parentNode.insertBefore(buildMarquee(), section);
  });
})();

// --- Histoire photo carousel (auto-fade · pioche aléatoire dans la galerie) ---
(async function setupHistoireCarousel() {
  const carousel = document.getElementById('histoireCarousel');
  const dotsContainer = document.getElementById('histoireDots');
  if (!carousel || !dotsContainer) return;

  // Pioche aléatoire de N photos depuis le manifest
  const NB_SLIDES = 6;
  try {
    const res = await fetch('assets/gallery/manifest.json', { cache: 'no-store' });
    if (res.ok) {
      const manifest = await res.json();
      const allPhotos = [];
      Object.entries(manifest).forEach(([folder, files]) => {
        files.forEach(f => allPhotos.push('assets/gallery/' + folder + '/medium/' + f));
      });
      // Shuffle Fisher-Yates puis prend les N premiers
      for (let i = allPhotos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPhotos[i], allPhotos[j]] = [allPhotos[j], allPhotos[i]];
      }
      const picked = allPhotos.slice(0, NB_SLIDES);
      // Remplace toutes les slides existantes (sauf le container des dots)
      const existingSlides = carousel.querySelectorAll('.histoire-slide');
      existingSlides.forEach(s => s.remove());
      picked.forEach((src, i) => {
        const div = document.createElement('div');
        div.className = 'histoire-slide' + (i === 0 ? ' active' : '');
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'ESI · photo ' + (i + 1);
        img.loading = i === 0 ? 'eager' : 'lazy';
        div.appendChild(img);
        carousel.insertBefore(div, dotsContainer);
      });
    }
  } catch (err) {
    console.warn('[histoire] manifest non chargé, fallback sur slides statiques', err);
  }

  const slides = carousel.querySelectorAll('.histoire-slide');
  if (slides.length === 0) return;

  // Build dots
  dotsContainer.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'histoire-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Photo ' + (i + 1));
    dot.addEventListener('click', () => show(i, true));
    dotsContainer.appendChild(dot);
  });

  let current = 0;
  let timer;
  const dots = dotsContainer.querySelectorAll('.histoire-dot');

  function show(idx, manual) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
    if (manual) restart();
  }

  function next() { show(current + 1); }

  function start() { timer = setInterval(next, 4500); }
  function restart() { clearInterval(timer); start(); }

  // Pause on hover
  carousel.addEventListener('mouseenter', () => clearInterval(timer));
  carousel.addEventListener('mouseleave', start);

  // Pause when not in viewport (perf)
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) start();
      else clearInterval(timer);
    });
  }, { threshold: 0.2 });
  io.observe(carousel);
})();

// --- Timeline carousel ---
(function setupTimeline() {
  const track = document.getElementById('timelineTrack');
  const prev = document.getElementById('timelinePrev');
  const next = document.getElementById('timelineNext');
  const progress = document.getElementById('timelineProgress');
  if (!track || !prev || !next) return;

  const slideWidth = () => {
    const slide = track.querySelector('.timeline-slide');
    if (!slide) return 320;
    const style = getComputedStyle(track);
    return slide.offsetWidth + parseInt(style.gap || 20, 10);
  };

  function updateProgress() {
    const max = track.scrollWidth - track.clientWidth;
    if (max <= 0) { progress.style.width = '100%'; return; }
    const pct = Math.min(100, Math.max(0, (track.scrollLeft / max) * 100));
    progress.style.width = pct + '%';
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft >= max - 4;
  }

  prev.addEventListener('click', () => track.scrollBy({ left: -slideWidth(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: slideWidth(), behavior: 'smooth' }));
  track.addEventListener('scroll', updateProgress, { passive: true });

  // Keyboard nav when timeline is in viewport
  document.addEventListener('keydown', (e) => {
    const rect = track.getBoundingClientRect();
    if (rect.top > window.innerHeight || rect.bottom < 0) return;
    if (e.key === 'ArrowLeft' && document.activeElement.tagName !== 'INPUT') prev.click();
    if (e.key === 'ArrowRight' && document.activeElement.tagName !== 'INPUT') next.click();
  });

  updateProgress();
})();

// --- Team category filter ---
const catTags = document.querySelectorAll('.team-cat-tag');
const teamCards = document.querySelectorAll('.team-card');
catTags.forEach(tag => {
  tag.addEventListener('click', () => {
    catTags.forEach(t => t.classList.remove('active'));
    tag.classList.add('active');
    const filter = tag.dataset.filter;
    teamCards.forEach(card => {
      const match = filter === 'all' || card.dataset.cat === filter;
      card.style.display = match ? '' : 'none';
    });
  });
});

// --- Smooth scroll for anchor links ---
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// =================================================================
// AUTH STATE (mock — localStorage only, no real backend)
// =================================================================
const AUTH_KEY = 'esi-auth';
const VALIDATOR_EMAIL = 'adrien.goubert1@icloud.com';
const VALIDATED_EMAILS = new Set([
  VALIDATOR_EMAIL,
  // Add validated emails here (mock)
  'demo@esi.fr',
]);

const authBadge = document.getElementById('authBadge');
const authAvatar = document.getElementById('authAvatar');
const authName = document.getElementById('authName');

function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
  catch { return null; }
}
function setAuth(user) {
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_KEY);
  renderAuth();
}
function renderAuth() {
  const user = getAuth();
  // Update badge
  if (user) {
    const initials = (user.name || user.email).split(/[\s@.]/).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('').slice(0, 2) || 'U';
    authAvatar.textContent = initials;
    authName.textContent = user.role === 'dirigeant' ? 'Dirigeant' : (user.name?.split(' ')[0] || 'Compte');
    authBadge.classList.add('visible');
  } else {
    authBadge.classList.remove('visible');
  }
  // Toggle convocation locks
  const isLicencie = user && (user.role === 'licencie' || user.role === 'dirigeant');
  document.querySelectorAll('[data-lock]').forEach(lock => {
    lock.style.display = isLicencie ? 'none' : '';
  });
  // Toggle auth-gated elements (menu Convocations + section #convocations) via classe body
  document.body.classList.toggle('is-logged-in', !!isLicencie);
  // Toggle convoc banner
  const banner = document.getElementById('convocBanner');
  if (banner) {
    banner.classList.toggle('logged', !!isLicencie);
    banner.querySelector('[data-state="guest"]').style.display = isLicencie ? 'none' : '';
    banner.querySelector('[data-state="logged"]').style.display = isLicencie ? '' : 'none';
  }
}
authBadge.addEventListener('click', () => {
  if (confirm('Se déconnecter ?')) setAuth(null);
});
renderAuth();

// =================================================================
// LOGIN MODAL
// =================================================================
const loginBackdrop = document.getElementById('loginBackdrop');
function openLogin(initialTab = 'licencie') {
  loginBackdrop.classList.add('open');
  switchLoginForm(initialTab === 'dirigeant' ? 'dirigeant' : 'licencie');
  if (initialTab === 'dirigeant') {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.loginTab === 'dirigeant'));
  } else {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.loginTab === 'licencie'));
  }
}
function closeLogin() { loginBackdrop.classList.remove('open'); clearLoginMsgs(); }
function switchLoginForm(name) {
  document.querySelectorAll('.login-form').forEach(f => f.classList.toggle('active', f.dataset.loginForm === name));
  clearLoginMsgs();
}
function clearLoginMsgs() {
  document.querySelectorAll('.login-message').forEach(m => { m.classList.remove('show', 'success', 'error', 'info'); m.textContent = ''; });
}
function showMsg(id, type, text) {
  const m = document.getElementById(id);
  if (!m) return;
  m.className = 'login-message show ' + type;
  m.textContent = text;
}

document.querySelectorAll('[data-open-login]').forEach(b => {
  b.addEventListener('click', e => { e.preventDefault(); openLogin(b.dataset.openLogin); });
});
document.querySelectorAll('[data-close-login]').forEach(b => b.addEventListener('click', closeLogin));
loginBackdrop.addEventListener('click', e => { if (e.target === loginBackdrop) closeLogin(); });
document.querySelectorAll('.login-tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.login-tab').forEach(o => o.classList.remove('active'));
    t.classList.add('active');
    switchLoginForm(t.dataset.loginTab);
  });
});
document.querySelectorAll('[data-switch-form]').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); switchLoginForm(a.dataset.switchForm); });
});

// LICENCIÉ login
document.querySelector('[data-login-form="licencie"]').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pwd = document.getElementById('loginPwd').value;
  if (!email || !pwd) { showMsg('loginMsg', 'error', 'Email et mot de passe requis.'); return; }
  if (!VALIDATED_EMAILS.has(email)) {
    showMsg('loginMsg', 'error', '❌ Compte non trouvé ou non encore validé. Demande un accès ou contacte Adrien Goubert.');
    return;
  }
  showMsg('loginMsg', 'success', '✓ Connexion réussie. Accès aux convocations.');
  setAuth({ email, name: email.split('@')[0], role: 'licencie' });
  setTimeout(closeLogin, 900);
});

// SIGNUP request
document.querySelector('[data-login-form="signup"]').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const cat = document.getElementById('signupCat').value;
  if (!name || !email || !cat) { showMsg('signupMsg', 'error', 'Tous les champs sont obligatoires.'); return; }
  // Mock — would POST to backend in production
  showMsg('signupMsg', 'success', `✓ Demande envoyée à ${VALIDATOR_EMAIL}. Tu recevras un email dès que ton compte sera validé.`);
  e.target.reset();
});

// DIRIGEANT login → opens dirigeant space
document.querySelector('[data-login-form="dirigeant"]').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('staffEmail').value.trim().toLowerCase();
  const pwd = document.getElementById('staffPwd').value;
  if (!email || !pwd) { showMsg('staffMsg', 'error', 'Identifiants requis.'); return; }
  if (email !== VALIDATOR_EMAIL && !email.endsWith('@esi-isigny.fr')) {
    showMsg('staffMsg', 'error', '❌ Identifiants invalides. Contacte Adrien Goubert.');
    return;
  }
  showMsg('staffMsg', 'success', '✓ Accès dirigeant accordé.');
  setAuth({ email, name: 'Dirigeant', role: 'dirigeant' });
  setTimeout(() => {
    closeLogin();
    document.getElementById('dirigeantBackdrop').classList.add('open');
  }, 900);
});

// DIRIGEANT modal
document.querySelectorAll('[data-close-dirigeant]').forEach(b => b.addEventListener('click', () => {
  document.getElementById('dirigeantBackdrop').classList.remove('open');
}));
document.getElementById('dirigeantBackdrop').addEventListener('click', e => {
  if (e.target.id === 'dirigeantBackdrop') e.currentTarget.classList.remove('open');
});
document.getElementById('convocForm').addEventListener('submit', e => {
  e.preventDefault();
  alert('✓ Convocation publiée (démo). Un backend est requis pour la sauvegarder réellement.');
});

// =================================================================
// DIRIGEANT TABS (Convocation / Agents IA / Upload)
// =================================================================
const dirigeantTabs = document.querySelectorAll('[data-dirigeant-tab]');
const dirigeantPanels = document.querySelectorAll('[data-dirigeant-panel]');
const dirigeantTitle = document.getElementById('dirigeantTitle');
const TAB_TITLES = {
  convoc: { fr: 'Publier une convocation', en: 'Publish a call-up' },
  agents: { fr: '10 agents IA · status temps réel', en: '10 AI agents · live status' },
  upload: { fr: 'Uploader des photos', en: 'Upload photos' },
};
dirigeantTabs.forEach(t => {
  t.addEventListener('click', () => {
    const key = t.dataset.dirigeantTab;
    dirigeantTabs.forEach(o => o.classList.toggle('active', o === t));
    dirigeantPanels.forEach(p => p.hidden = (p.dataset.dirigeantPanel !== key));
    const title = TAB_TITLES[key];
    dirigeantTitle.innerHTML = `<span data-lang="fr">${title.fr}</span><span data-lang="en">${title.en}</span>`;
    if (key === 'agents') renderAgents();
  });
});

// =================================================================
// AGENTS UI (mock data — would be GET /api/agents/status when deployed)
// =================================================================
const AGENTS_DATA = [
  { id: 1, name: 'FFF Results Sync',     desc: 'Scrape les résultats du week-end depuis FFF.fr',                   schedule: 'Lun 02:00', status: 'ok',      last: 'il y a 2j' },
  { id: 2, name: 'FFF Fixtures Sync',    desc: 'Pull du calendrier des 30 prochains jours',                        schedule: 'Lun 02:30', status: 'ok',      last: 'il y a 2j' },
  { id: 3, name: 'Classements Sync',     desc: 'Scrape les 7 poules ESI (Seniors A/B/F, Vétérans, U15×2, U13)',     schedule: 'Lun 03:00', status: 'ok',      last: 'il y a 2j' },
  { id: 4, name: 'Match Report Writer',  desc: 'Compte-rendu rédigé par Claude Haiku pour chaque match joué',      schedule: 'Lun 04:00', status: 'pending', last: '—' },
  { id: 5, name: 'Convocation Reminder', desc: 'Email/SMS aux joueurs convoqués 24h avant le match',               schedule: 'Tous 18:00', status: 'pending', last: '—' },
  { id: 6, name: 'Social Media Poster',  desc: 'Auto-publication des résultats sur Instagram + Facebook',          schedule: 'Lun 09:00', status: 'pending', last: '—' },
  { id: 7, name: 'SEO Optimizer',        desc: 'Refresh sitemap, meta description, Schema.org Events',             schedule: 'Dim 23:00', status: 'ok',      last: 'il y a 1j' },
  { id: 8, name: 'Image Optimizer',      desc: 'WebP + thumbnail à chaque upload de photo',                        schedule: 'À l\'upload', status: 'pending', last: '—' },
  { id: 9, name: 'Stats Aggregator',     desc: 'Calcule les stats club : par équipe + global',                     schedule: 'Lun 05:00', status: 'ok',      last: 'il y a 2j' },
  { id: 10,name: 'Chatbot Trainer',      desc: 'Met à jour la base de connaissances du chatbot ESI',               schedule: 'Dim 22:00', status: 'ok',      last: 'il y a 1j' },
];

function renderAgents() {
  const grid = document.getElementById('agentsGrid');
  if (!grid) return;
  grid.innerHTML = AGENTS_DATA.map(a => `
    <div class="agent-row">
      <div class="agent-num">${String(a.id).padStart(2,'0')}</div>
      <div>
        <div class="agent-info-name">${a.name}</div>
        <div class="agent-info-desc">${a.desc}</div>
      </div>
      <span class="agent-schedule">${a.schedule}</span>
      <span class="agent-status ${a.status}" title="${a.status === 'ok' ? 'OK · ' + a.last : a.status === 'pending' ? 'En attente · backend non déployé' : 'Erreur'}"></span>
    </div>
  `).join('');
  // Update last-run summary
  const okAgents = AGENTS_DATA.filter(a => a.status === 'ok');
  document.getElementById('agentsLastRun').textContent = okAgents.length ? '02:00' : '—';
  const health = document.getElementById('agentsHealth').querySelector('strong');
  const failing = AGENTS_DATA.filter(a => a.status === 'error').length;
  health.textContent = failing === 0 ? '✓' : `${failing}`;
  health.style.color = failing === 0 ? 'var(--win)' : 'var(--loss)';
}

document.getElementById('agentsRefresh')?.addEventListener('click', renderAgents);

// =================================================================
// UPLOAD (preview only — backend required to actually persist)
// =================================================================
const uploadDrop = document.getElementById('uploadDrop');
const uploadInput = document.getElementById('uploadInput');
const uploadPreview = document.getElementById('uploadPreview');
const uploadBtn = document.getElementById('uploadBtn');
let uploadFiles = [];

function handleFiles(files) {
  uploadFiles = Array.from(files).slice(0, 20);
  uploadPreview.innerHTML = '';
  uploadFiles.forEach(f => {
    const url = URL.createObjectURL(f);
    const img = document.createElement('img');
    img.src = url;
    img.alt = f.name;
    uploadPreview.appendChild(img);
  });
  uploadBtn.disabled = uploadFiles.length === 0;
  uploadBtn.textContent = uploadFiles.length
    ? `Publier ${uploadFiles.length} photo${uploadFiles.length > 1 ? 's' : ''} (démo)`
    : 'Publier (démo)';
}

uploadInput?.addEventListener('change', e => handleFiles(e.target.files));
uploadDrop?.addEventListener('dragover', e => { e.preventDefault(); uploadDrop.classList.add('dragover'); });
uploadDrop?.addEventListener('dragleave', () => uploadDrop.classList.remove('dragover'));
uploadDrop?.addEventListener('drop', e => {
  e.preventDefault();
  uploadDrop.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
uploadBtn?.addEventListener('click', () => {
  alert(`✓ ${uploadFiles.length} photo(s) ajoutées en file (démo).\n\nUne fois le backend déployé :\n→ Agent 08 va les optimiser (WebP + thumbnail)\n→ Elles apparaîtront dans la galerie en moins de 30s.`);
  uploadFiles = [];
  uploadInput.value = '';
  uploadPreview.innerHTML = '';
  uploadBtn.disabled = true;
});

// =================================================================
// CLASSEMENTS (full FFF data, scraped)
// =================================================================
const CLASSEMENTS = {
  'seniors-a': {
    title: 'Classement Seniors A',
    subtitle: 'D4 · Poule C · JBS Prorété · Mis à jour 3 mai 2026',
    lastMatch: { date: '26 avr', home: 'ESI Seniors A', away: 'AS St Jores 2', score: '7-0', result: 'win', venue: 'home', logoHome: '501416', logoAway: '521699' },
    nextMatch: { date: 'Dim. 10 mai · 15h00', home: 'ESI Seniors A', away: 'AS Montmartin Graig.', venue: 'home', logoHome: '501416', logoAway: '549413' },
    rows: [
      {pos:1, team:'Periers S. 2', pts:35, j:13, g:11, n:2, p:0, bp:56, bc:10, diff:46},
      {pos:2, team:'ES Isigny sur Mer', pts:31, j:14, g:10, n:1, p:3, bp:46, bc:14, diff:32, esi:true},
      {pos:3, team:"ES de l'Ay 2", pts:28, j:13, g:9, n:1, p:3, bp:31, bc:8, diff:23},
      {pos:4, team:'ES des Marais 2', pts:26, j:12, g:8, n:2, p:2, bp:29, bc:16, diff:13},
      {pos:5, team:'AS Montmartin Graig.', pts:16, j:13, g:5, n:2, p:5, bp:16, bc:27, diff:-11},
      {pos:6, team:'Aubigny SC', pts:10, j:14, g:3, n:2, p:8, bp:18, bc:44, diff:-26},
      {pos:7, team:'ES Munevillaise 2', pts:9, j:13, g:3, n:2, p:6, bp:21, bc:36, diff:-15},
      {pos:8, team:'AS St Jores 2', pts:6, j:12, g:1, n:3, p:8, bp:20, bc:45, diff:-25},
      {pos:9, team:'US Vesly Laulne 2', pts:3, j:14, g:0, n:3, p:11, bp:12, bc:49, diff:-37},
      {pos:10, team:'Ent. CSC Montebourg 4', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
      {pos:11, team:'AJ St Hilaire PV 3', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
      {pos:12, team:'Creances S. 2', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
    ],
  },
  'seniors-b': {
    title: 'Classement Seniors B',
    subtitle: 'D4 · Poule D · JBS Prorété · Mis à jour 3 mai 2026',
    lastMatch: { date: '2 mai', home: 'AS Théreval 2', away: 'ESI Seniors B', score: '1-2', result: 'win', venue: 'away', logoHome: '531034', logoAway: '501416', highlight: 'Première victoire de la saison' },
    nextMatch: { date: 'Dim. 17 mai · 15h00', home: 'ESI Seniors B', away: 'AS Théreval 2', venue: 'home', logoHome: '501416', logoAway: '531034', note: 'Revanche' },
    rows: [
      {pos:1, team:"FC de l'Elle 2", pts:40, j:15, g:13, n:1, p:1, bp:50, bc:15, diff:35},
      {pos:2, team:'ES Marigny Lozon M.V', pts:36, j:13, g:12, n:0, p:1, bp:43, bc:15, diff:28},
      {pos:3, team:'CA Pontois 3', pts:33, j:16, g:10, n:3, p:3, bp:46, bc:18, diff:28},
      {pos:4, team:'US Aireloise', pts:29, j:15, g:9, n:2, p:4, bp:30, bc:24, diff:6},
      {pos:5, team:'US Semilly St André 2', pts:15, j:15, g:4, n:3, p:8, bp:20, bc:32, diff:-12},
      {pos:6, team:'AS Bérigny Cerisy 3', pts:15, j:14, g:5, n:2, p:6, bp:27, bc:25, diff:2},
      {pos:7, team:'FC 3 Rivières 3', pts:11, j:15, g:4, n:2, p:6, bp:29, bc:40, diff:-11},
      {pos:8, team:'AS Théreval 2', pts:11, j:17, g:3, n:3, p:10, bp:25, bc:39, diff:-14},
      {pos:9, team:'US Ste Croix St Lo 3', pts:10, j:16, g:4, n:1, p:9, bp:19, bc:45, diff:-26},
      {pos:10, team:'ES Isigny sur Mer 2', pts:2, j:16, g:1, n:1, p:13, bp:10, bc:47, diff:-37, esi:true},
      {pos:11, team:'Ent. Domjean St Jean', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
      {pos:12, team:'Ent.StJores.Auvers 3', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
    ],
  },
  'seniors-f': {
    title: 'Classement Seniors F',
    subtitle: 'A8 Sport 200 Lequertier · D2 Nord · Mis à jour 3 mai 2026',
    lastMatch: { date: '26 avr', home: 'ESI Seniors F', away: 'Ent. Plain Haytillon', score: '3-1', result: 'win', venue: 'home', logoHome: '501416', logoAway: '563667' },
    nextMatch: { date: 'Ven. 8 mai · 20h30', home: 'AS Pointe Cotentin', away: 'ESI Seniors F', venue: 'away', logoHome: '547673', logoAway: '501416' },
    rows: [
      {pos:1, team:'CA Pontois', pts:34, j:15, g:10, n:4, p:1, bp:57, bc:29, diff:28},
      {pos:2, team:'Ent. USCI / USPSG', pts:34, j:16, g:10, n:4, p:2, bp:55, bc:22, diff:33},
      {pos:3, team:'US Auversoise', pts:29, j:17, g:8, n:5, p:4, bp:44, bc:31, diff:13},
      {pos:4, team:'ES Isigny sur Mer', pts:24, j:14, g:8, n:0, p:6, bp:27, bc:26, diff:1, esi:true},
      {pos:5, team:'AS Montebourg', pts:22, j:14, g:7, n:1, p:6, bp:35, bc:26, diff:9},
      {pos:6, team:'ES des Marais', pts:22, j:15, g:7, n:1, p:7, bp:33, bc:41, diff:-8},
      {pos:7, team:'AS Pointe Cotentin', pts:16, j:14, g:5, n:2, p:6, bp:20, bc:27, diff:-7},
      {pos:8, team:'Ent. Plain Haytillon', pts:15, j:15, g:5, n:2, p:6, bp:19, bc:29, diff:-10},
      {pos:9, team:'ES Heauville Siouvil', pts:6, j:16, g:2, n:1, p:12, bp:19, bc:48, diff:-29},
      {pos:10, team:'Ent.USSJ/Rauville', pts:6, j:14, g:2, n:2, p:8, bp:17, bc:47, diff:-30},
      {pos:11, team:'Ent.ASSUN/FCEH À 8 2', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
      {pos:12, team:'El. de Tocqueville', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
    ],
  },
  'veterans': {
    title: 'Classement Vétérans',
    subtitle: 'Championnat Vétérans · Poule B · Mis à jour 3 mai 2026',
    lastMatch: { date: '10 avr', home: 'US Auversoise', away: 'ESI Vétérans', score: '0-0', result: 'draw', venue: 'away', logoHome: '501399', logoAway: '501416' },
    nextMatch: { date: 'Ven. 15 mai · 21h00', home: 'ESI Vétérans', away: 'FC St-Lô Manche', venue: 'home', logoHome: '501416', logoAway: '500088' },
    rows: [
      {pos:1, team:'Agneaux FC', pts:25, j:9, g:8, n:1, p:0, bp:35, bc:9, diff:26},
      {pos:2, team:'FC St Lo Manche', pts:23, j:9, g:7, n:2, p:0, bp:32, bc:7, diff:25},
      {pos:3, team:'US Auversoise', pts:18, j:11, g:6, n:1, p:3, bp:35, bc:24, diff:11},
      {pos:4, team:'FC 3 Rivières', pts:13, j:11, g:4, n:1, p:6, bp:22, bc:21, diff:1},
      {pos:5, team:'AS Cahagnaise', pts:8, j:9, g:2, n:2, p:5, bp:15, bc:26, diff:-11},
      {pos:6, team:'ES Isigny sur Mer', pts:5, j:8, g:1, n:3, p:3, bp:14, bc:19, diff:-5, esi:true},
      {pos:7, team:'CA Pontois', pts:0, j:9, g:0, n:0, p:9, bp:12, bc:59, diff:-47},
      {pos:8, team:'EDA', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
      {pos:9, team:'US Ste Croix St Lo', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
    ],
  },
  'u15-1': {
    title: 'Classement U15 (1) — 1ᵉʳ',
    subtitle: 'U15 D3 · Poule B · Phase Printemps · Mis à jour 3 mai 2026',
    lastMatch: { date: '2 mai', home: 'AS Valognes F. 2', away: 'ESI U15 (1)', score: '3-4', result: 'win', venue: 'away', logoHome: '500140', logoAway: '501416' },
    nextMatch: { date: 'Sam. 9 mai · 15h00', home: 'ESI U15 (1)', away: 'SM Haytillon', venue: 'home', logoHome: '501416', logoAway: '510449' },
    rows: [
      {pos:1, team:'ES Isigny sur Mer', pts:12, j:5, g:4, n:0, p:1, bp:39, bc:14, diff:25, esi:true},
      {pos:2, team:'CS Carentanais 2', pts:12, j:5, g:4, n:0, p:1, bp:29, bc:7, diff:22},
      {pos:3, team:'SM Haytillon', pts:9, j:4, g:3, n:0, p:1, bp:23, bc:7, diff:16},
      {pos:4, team:'PL Octeville', pts:9, j:4, g:3, n:0, p:1, bp:20, bc:7, diff:13},
      {pos:5, team:'AS Valognes F. 2', pts:6, j:4, g:2, n:0, p:2, bp:29, bc:10, diff:19},
      {pos:6, team:'AS Montebourg', pts:4, j:5, g:1, n:1, p:3, bp:5, bc:13, diff:-8},
      {pos:7, team:'Ent. USCI 2 - RSSV 2', pts:1, j:4, g:0, n:1, p:3, bp:5, bc:25, diff:-20},
      {pos:8, team:'Ent.UCB B2S 2', pts:-1, j:5, g:0, n:0, p:4, bp:0, bc:67, diff:-67},
      {pos:9, team:'Ent.ASQ-FCEH', pts:'FG', j:0, g:0, n:0, p:0, bp:0, bc:0, diff:0},
    ],
  },
  'u15-2': {
    title: 'Classement U15 (2) · Entente',
    subtitle: 'U15 D3 · Poule C · Phase Printemps · Ent. Isigny–Carentan',
    lastMatch: { date: '2 mai', home: 'Ent. Isigny–Carentan 2', away: "ES de l'Ay 2", score: '10-1', result: 'win', venue: 'home', logoHome: '501416', logoAway: '565165', highlight: 'Festival offensif · 10 buts marqués' },
    nextMatch: { date: 'Sam. 9 mai · 15h00', home: 'Ent. FC3R/Condé', away: 'Ent. Isigny–Carentan 2', venue: 'away', logoHome: '581303', logoAway: '501416' },
    rows: [
      {pos:1, team:'Agneaux FC 2', pts:12, j:4, g:4, n:0, p:0, bp:48, bc:2, diff:46},
      {pos:2, team:'ES Marigny Lozon M.V', pts:12, j:4, g:4, n:0, p:0, bp:18, bc:5, diff:13},
      {pos:3, team:'ES St Sauveur Rond.', pts:9, j:4, g:3, n:0, p:1, bp:28, bc:4, diff:24},
      {pos:4, team:'Ent.AJSHP/ES Plain', pts:7, j:5, g:2, n:1, p:2, bp:13, bc:30, diff:-17},
      {pos:5, team:'Ent. FCE/CAP', pts:6, j:4, g:2, n:0, p:2, bp:12, bc:16, diff:-4},
      {pos:6, team:"ES de l'Ay 2", pts:3, j:5, g:1, n:0, p:4, bp:8, bc:31, diff:-23},
      {pos:7, team:'Ent. Agon VSM 2 2', pts:3, j:5, g:1, n:1, p:2, bp:6, bc:34, diff:-28},
      {pos:8, team:'Ent. FC3R/Condé', pts:3, j:5, g:1, n:0, p:4, bp:7, bc:14, diff:-7},
      {pos:9, team:'Ent. Isigny–Carentan 2', pts:1, j:5, g:1, n:0, p:4, bp:16, bc:34, diff:-18, esi:true},
    ],
  },
  'u13': {
    title: 'Classement U13',
    subtitle: 'U13 Niveau 4 · Poule B · Printemps · Mis à jour 3 mai 2026',
    lastMatch: { date: '2 mai', home: 'AS Bérigny Cerisy', away: 'ESI U13', score: '6-0', result: 'loss', venue: 'away', logoHome: '527693', logoAway: '501416' },
    nextMatch: { date: 'Sam. 9 mai · 13h15', home: 'ESI U13', away: 'US Roncey Cerisy 2', venue: 'home', logoHome: '501416', logoAway: '581301' },
    rows: [
      {pos:1, team:'ES Coutancaise 4', pts:12, j:4, g:4, n:0, p:0, bp:34, bc:6, diff:28},
      {pos:2, team:'AS Bérigny Cerisy', pts:9, j:3, g:3, n:0, p:0, bp:10, bc:1, diff:9},
      {pos:3, team:'US Roncey Cerisy 2', pts:3, j:3, g:1, n:0, p:2, bp:7, bc:10, diff:-3},
      {pos:4, team:'FC des Étangs 3', pts:3, j:5, g:1, n:0, p:4, bp:14, bc:23, diff:-9},
      {pos:5, team:'Ent. Condé / St Jean 3', pts:3, j:3, g:1, n:0, p:2, bp:9, bc:14, diff:-5},
      {pos:6, team:'ES Isigny sur Mer', pts:3, j:4, g:1, n:0, p:3, bp:6, bc:26, diff:-20, esi:true},
    ],
  },
};

const classementBackdrop = document.getElementById('classementBackdrop');
const classementTitle = document.getElementById('classementTitle');
const classementSubtitle = document.getElementById('classementSubtitle');
const classementTbody = document.getElementById('classementTbody');
const classementRecap = document.getElementById('classementRecap');

function logoSrc(code) { return `assets/logos/${code}.jpg`; }

function renderRecapCards(c) {
  if (!classementRecap) return;
  const lm = c.lastMatch, nm = c.nextMatch;
  let html = '';

  if (lm) {
    const resultLabel = lm.result === 'win' ? 'Victoire' : lm.result === 'loss' ? 'Défaite' : 'Nul';
    const venueLabel = lm.venue === 'home' ? 'Domicile' : 'Extérieur';
    html += `
      <div class="recap-card last ${lm.result}">
        <div class="recap-label">📊 <span data-lang="fr">Dernier match · ${lm.date}</span><span data-lang="en">Last match · ${lm.date}</span></div>
        <div class="recap-teams">
          <div class="recap-team">
            <img src="${logoSrc(lm.logoHome)}" alt="${lm.home}" loading="lazy">
            <div class="recap-team-name">${lm.home}</div>
          </div>
          <div class="recap-score">${lm.score}</div>
          <div class="recap-team">
            <img src="${logoSrc(lm.logoAway)}" alt="${lm.away}" loading="lazy">
            <div class="recap-team-name">${lm.away}</div>
          </div>
        </div>
        <div class="recap-meta">
          <span>${venueLabel}</span>
          <span class="recap-result-badge">${resultLabel}${lm.highlight ? ' · ' + lm.highlight : ''}</span>
        </div>
      </div>`;
  }

  if (nm) {
    const venueLabel = nm.venue === 'home' ? 'Domicile' : 'Extérieur';
    html += `
      <div class="recap-card next">
        <div class="recap-label">⏭ <span data-lang="fr">Prochain match · ${nm.date}</span><span data-lang="en">Next match · ${nm.date}</span></div>
        <div class="recap-teams">
          <div class="recap-team">
            <img src="${logoSrc(nm.logoHome)}" alt="${nm.home}" loading="lazy">
            <div class="recap-team-name">${nm.home}</div>
          </div>
          <div class="recap-vs">VS</div>
          <div class="recap-team">
            <img src="${logoSrc(nm.logoAway)}" alt="${nm.away}" loading="lazy">
            <div class="recap-team-name">${nm.away}</div>
          </div>
        </div>
        <div class="recap-meta">
          <span>${venueLabel}</span>
          <span class="recap-result-badge" style="color:var(--electric);">${nm.note || 'À venir'}</span>
        </div>
      </div>`;
  }

  classementRecap.innerHTML = html;
}

function openClassement(key) {
  const c = CLASSEMENTS[key];
  if (!c) return;
  classementTitle.textContent = c.title;
  classementSubtitle.textContent = c.subtitle;

  renderRecapCards(c);

  classementTbody.innerHTML = c.rows.map(r => {
    const posClass = r.pos <= 3 ? `pos pos-${r.pos}` : 'pos';
    const diff = typeof r.diff === 'number' ? (r.diff > 0 ? `+${r.diff}` : r.diff) : r.diff;
    const diffClass = typeof r.diff === 'number' ? (r.diff > 0 ? 'diff-pos' : (r.diff < 0 ? 'diff-neg' : '')) : '';
    return `<tr class="${r.esi ? 'is-esi' : ''}">
      <td class="num"><span class="${posClass}">${r.pos}</span></td>
      <td class="team-name">${r.team}</td>
      <td class="num">${r.pts}</td>
      <td class="num">${r.j}</td>
      <td class="num">${r.g}</td>
      <td class="num">${r.n}</td>
      <td class="num">${r.p}</td>
      <td class="num ${diffClass}">${diff}</td>
    </tr>`;
  }).join('');

  // Scroll modal to top when opening
  classementBackdrop.querySelector('.modal').scrollTop = 0;
  classementBackdrop.classList.add('open');
}
function closeClassement() { classementBackdrop.classList.remove('open'); }
document.querySelectorAll('[data-classement]').forEach(b => {
  b.addEventListener('click', () => openClassement(b.dataset.classement));
});

// --- Injection du lien "Fiche complète →" sur chaque team-card pour SEO + accès direct page dédiée ---
(function injectTeamCardLinks() {
  document.querySelectorAll('.team-card[data-team-page]').forEach(card => {
    const url = card.dataset.teamPage;
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.className = 'team-card-link-badge';
    link.setAttribute('aria-label', 'Voir la fiche complète de cette équipe');
    link.innerHTML = 'Fiche <svg viewBox="0 0 12 12"><path d="M3 6h6m-2.5-2.5L9 6 6.5 8.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // stopPropagation : un clic sur le badge ne déclenche pas le modal classement de la card parente
    link.addEventListener('click', (e) => { e.stopPropagation(); });

    // Pour les <button> on ne peut pas insérer un <a> à l'intérieur (HTML invalide)
    // → on l'attache au parent (.team-grid > div ou directement dans team-card si elle est <article>)
    if (card.tagName === 'BUTTON') {
      // Wrappe le button dans un div positionné, et place le badge à côté
      if (!card.parentElement.classList.contains('team-card-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'team-card-wrap';
        wrap.style.position = 'relative';
        card.parentNode.insertBefore(wrap, card);
        wrap.appendChild(card);
      }
      card.parentElement.appendChild(link);
    } else {
      // <article> : on peut insérer le badge directement à l'intérieur
      card.appendChild(link);
    }
  });
})();
document.querySelectorAll('[data-close-classement]').forEach(b => b.addEventListener('click', closeClassement));
classementBackdrop.addEventListener('click', e => { if (e.target === classementBackdrop) closeClassement(); });

// =================================================================
// CHATBOT (rule-based — works without backend)
// =================================================================
const chatFab = document.getElementById('chatbotFab');
const chatDrawer = document.getElementById('chatbotDrawer');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

function toggleChat(force) {
  const willOpen = force !== undefined ? force : !chatDrawer.classList.contains('open');
  chatDrawer.classList.toggle('open', willOpen);
  chatFab.classList.toggle('open', willOpen);
  if (willOpen) setTimeout(() => chatInput.focus(), 200);
}
chatFab.addEventListener('click', () => toggleChat());

function addMsg(text, sender) {
  const msg = document.createElement('div');
  msg.className = 'chat-msg ' + sender;
  msg.innerHTML = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

const CHAT_RULES = [
  { kw: ['prochain match', 'next match', 'prochain', 'demain', 'samedi', 'dimanche', 'sam 9', 'dim 10'],
    a: 'Le <strong>prochain match Seniors A</strong> est <strong>Dim. 10 mai à 15h00</strong> — ESI vs AS Montmartin Graig. (Domicile, D4 Poule C, J20). Avant ça : <strong>Sam. 9 mai 13h15</strong> ESI U13 vs Roncey, et <strong>15h00</strong> ESI U15 (1er du classement !) vs SM Haytillon. <a href="#calendrier">Voir le calendrier</a>' },
  { kw: ['seniors a', 'seniors 1', 'séniors a', 'équipe première'],
    a: '<strong>Seniors A — D4 Poule C : 2ᵉ/12 (↑1)</strong> · 31 pts · 14J · 10G/1N/3P · 46 BP / 14 BC · +32 diff. Forme : V V V (3 victoires d\'affilée). Prochain : <strong>Dim. 10 mai 15h vs AS Montmartin</strong> (Dom).' },
  { kw: ['seniors b', 'seniors 2', 'séniors b', 'réserve'],
    a: '<strong>Seniors B — D4 Poule D : 10ᵉ/12 · 2 pts (+3)</strong> · 16J · 1G/1N/13P · -37 diff. <strong>Première victoire</strong> le 2 mai 1-2 contre Théreval. Prochain : <strong>Dim. 17 mai 15h vs Théreval (revanche)</strong>, à domicile.' },
  { kw: ['seniors f', 'féminin', 'feminine', 'feminin', 'femme', 'women'],
    a: '<strong>Seniors F — A8 D2 Nord : 4ᵉ/12 · 24 pts</strong> · 14J · 8G/0N/6P · +1 diff. Prochain : <strong>Ven. 8 mai 20h30 vs AS Pointe Cotentin</strong> (Ext).' },
  { kw: ['vétéran', 'veteran', 'vétérans'],
    a: '<strong>Vétérans — Poule B : 6ᵉ/9 · 5 pts</strong> · 8J · 1G/3N/3P. Prochain : <strong>Ven. 15 mai 21h vs FC St-Lô Manche</strong> (Dom).' },
  { kw: ['u15 (1)', 'u15 1', 'u15-1'],
    a: '<strong>U15 (1) — D3 Poule B Printemps : 1ᵉʳ/9 · 12 pts</strong> · 5J · 4G/0N/1P · 39 BP / 14 BC · +25 diff. Victoire 4-3 à Valognes le 2 mai. Prochain : <strong>Sam. 9 mai 15h vs SM Haytillon</strong> (Dom).' },
  { kw: ['u15 (2)', 'u15 2', 'u15-2', 'entente', 'carentan'],
    a: '<strong>U15 (2) Ent. Isigny–Carentan — D3 Poule C :</strong> Festival offensif le 2 mai, victoire <strong>10-1 contre ES de l\'Ay 2</strong>. Prochain : Sam. 9 mai 15h vs Ent. FC3R/Condé (Ext).' },
  { kw: ['u15', 'u14', 'jeunes 15'],
    a: 'Deux équipes U15 à l\'ESI :<br>• <strong>U15 (1)</strong> — 1ᵉʳ/9, 12 pts, +25 diff<br>• <strong>U15 (2) Ent. Isigny–Carentan</strong> — victoire 10-1 le 2 mai<br>Demande "u15 1" ou "u15 2" pour le détail.' },
  { kw: ['u13', 'u12', 'jeunes 13'],
    a: '<strong>U13 — Niveau 4 Poule B : 6ᵉ/6 · 3 pts</strong> · 4J · 1G/0N/3P · -20 diff. Saison difficile, équipe en construction. Prochain : <strong>Sam. 9 mai 13h15 vs US Roncey Cerisy 2</strong> (Dom).' },
  { kw: ['classement', 'rank', 'standing', 'position'],
    a: '<strong>Classements 3 mai 2026 :</strong><br>• Seniors A — 2ᵉ/12 (31 pts)<br>• Seniors B — 10ᵉ/12 (2 pts, 1ʳᵉ V)<br>• Seniors F — 4ᵉ/12 (24 pts)<br>• Vétérans — 6ᵉ/9 (5 pts)<br>• U15 (1) — 1ᵉʳ/9 (12 pts)<br>• U15 (2) Ent. — 9ᵉ/9 (1 pt)<br>• U13 — 6ᵉ/6 (3 pts)<br>Clique sur une équipe dans la section "Toutes nos équipes" pour voir le classement complet.' },
  { kw: ['rejoindre', 'inscription', 'inscrire', 'comment faire', 'club', 'jouer'],
    a: 'Pour <strong>rejoindre l\'ESI</strong>, contacte-nous à <a href="mailto:etoilesportiveisigny@gmail.com">etoilesportiveisigny@gmail.com</a> ou viens directement au stade. Toutes catégories de U7 à Vétérans, hommes et femmes.' },
  { kw: ['stade', 'adresse', 'où', 'venir', 'lieu', 'plan'],
    a: '<strong>Stade Municipal d\'Isigny</strong> · Impasse du Stade · 14230 Isigny-sur-Mer · Bessin, Normandie. <a href="https://www.google.com/maps?q=Stade+Municipal+Isigny-sur-Mer" target="_blank">Voir sur Maps</a>' },
  { kw: ['entraîneur', 'entraineur', 'coach', 'staff', 'dirigeant', 'qui'],
    a: '<strong>Encadrement :</strong><br>• Seniors A : Thomas Pottier<br>• Seniors B : Adrien Goubert / Alain Piazza / Jessy Thomine<br>• U15 : Théo Castel · U13 : Evann Lecourt · U11 : Pierre Goubert · U9 : Jessy Thomine / Lionnel Lepainteur. <a href="#staff">Voir tous les dirigeants</a>' },
  { kw: ['convocation', 'convoq', 'sélection', 'liste'],
    a: 'Les <strong>convocations</strong> sont dans la <a href="#convocations">section Convocations</a>. Liste complète des joueurs réservée aux licenciés (compte ESI requis).' },
  { kw: ['fondé', 'histoire', 'créé', 'cree', 'année', 'ans', '1925', 'depuis quand'],
    a: 'L\'<strong>Étoile Sportive d\'Isigny</strong> a été fondée en <strong>1925</strong>. Le club fête ses <strong>100 ans</strong> en 2025-26. Un siècle de football amateur en Manche.' },
  { kw: ['merci', 'thanks', 'thank you', 'super', 'cool'],
    a: 'Avec plaisir. Allez ESI.' },
  { kw: ['bonjour', 'salut', 'hello', 'hi', 'hey', 'coucou'],
    a: 'Bonjour. Je peux te renseigner sur les matchs, classements, convocations, le club. Pose ta question.' },
];

function answer(input) {
  const q = input.toLowerCase().trim();
  if (!q) return null;
  for (const r of CHAT_RULES) {
    if (r.kw.some(k => q.includes(k))) return r.a;
  }
  return `Désolé, je ne sais pas répondre à "<em>${input.slice(0, 40)}</em>". Essaie : <strong>prochain match</strong>, <strong>classement</strong>, <strong>convocation</strong>, <strong>stade</strong>, <strong>rejoindre</strong>, ou clique sur un raccourci ci-dessous.`;
}

function ask(text) {
  if (!text.trim()) return;
  addMsg(text.replace(/</g, '&lt;'), 'user');
  setTimeout(() => addMsg(answer(text), 'bot'), 350);
  chatInput.value = '';
}

chatForm.addEventListener('submit', e => { e.preventDefault(); ask(chatInput.value); });
document.querySelectorAll('.chat-suggestion').forEach(s => {
  s.addEventListener('click', () => ask(s.dataset.quick));
});

// =================================================================
// GALLERY ALBUMS + LIGHTBOX (lazy-loaded, keyboard nav)
// =================================================================
const ALBUM_MATCH_26_04 = ["1-DSC_0354.jpg","2-DSC_0356.jpg","3-DSC_0358.jpg","4-DSC_0359.jpg","5-DSC_0360.jpg","6-DSC_0361.jpg","7-DSC_0363.jpg","8-DSC_0366.jpg","9-DSC_0367.jpg","10-DSC_0369.jpg","12-DSC_0374.jpg","13-DSC_0376.jpg","14-DSC_0379.jpg","15-DSC_0381.jpg","17-DSC_0384.jpg","18-DSC_0385.jpg","19-DSC_0388.jpg","20-DSC_0389.jpg","21-DSC_0392.jpg","22-DSC_0393.jpg","23-DSC_0394.jpg","26-DSC_0397.jpg","27-DSC_0400.jpg","28-DSC_0401.jpg","29-DSC_0404.jpg","30-DSC_0406.jpg","31-DSC_0409.jpg","32-DSC_0411.jpg","33-DSC_0414.jpg","34-DSC_0415.jpg","35-DSC_0416.jpg","37-DSC_0422.jpg","39-DSC_0424.jpg","41-DSC_0427.jpg","42-DSC_0429.jpg","43-DSC_0431.jpg","44-DSC_0432.jpg","45-DSC_0437.jpg","46-DSC_0438.jpg","48-DSC_0450.jpg","50-DSC_0455.jpg","51-DSC_0458.jpg","53-DSC_0463.jpg","54-DSC_0466.jpg","55-DSC_0467.jpg","57-DSC_0472.jpg","60-DSC_0482.jpg","61-DSC_0485.jpg","62-DSC_0487.jpg","64-DSC_0490.jpg","65-DSC_0492.jpg","66-DSC_0496.jpg","68-DSC_0505.jpg","69-DSC_0507.jpg","70-DSC_0508.jpg","71-DSC_0511.jpg","72-DSC_0512.jpg","74-DSC_0516.jpg","75-DSC_0523.jpg","78-DSC_0535.jpg","79-DSC_0543.jpg","80-DSC_0546.jpg","81-DSC_0552.jpg","83-DSC_0561.jpg","84-DSC_0563.jpg","85-DSC_0566.jpg","87-DSC_0571.jpg","88-DSC_0575.jpg","89-DSC_0578.jpg","90-DSC_0580.jpg","91-DSC_0581.jpg","93-DSC_0585.jpg","94-DSC_0596.jpg","95-DSC_0597.jpg","96-DSC_0598.jpg","97-DSC_0600.jpg","98-DSC_0601.jpg","99-DSC_0603.jpg","100-DSC_0605.jpg","102-DSC_0613.jpg","103-DSC_0615.jpg","104-DSC_0617.jpg","106-DSC_0620.jpg","107-DSC_0625.jpg","108-DSC_0631.jpg","109-DSC_0632.jpg","110-DSC_0634.jpg","111-DSC_0636.jpg","112-DSC_0637.jpg","113-DSC_0640.jpg","114-DSC_0641.jpg","115-DSC_0642.jpg","116-DSC_0644.jpg","117-DSC_0647.jpg","118-DSC_0649.jpg","119-DSC_0652.jpg","120-DSC_0655.jpg","121-DSC_0657.jpg","122-DSC_0659.jpg","123-DSC_0660.jpg","124-DSC_0663.jpg","125-DSC_0667.jpg","126-DSC_0668.jpg","127-DSC_0671.jpg","128-DSC_0673.jpg","129-DSC_0676.jpg","130-DSC_0680.jpg","131-DSC_0681.jpg","132-DSC_0682.jpg","133-DSC_0689.jpg","134-DSC_0693.jpg","135-DSC_0695.jpg","136-DSC_0696.jpg","137-DSC_0698.jpg","138-DSC_0700.jpg","139-DSC_0704.jpg","140-DSC_0706.jpg","141-DSC_0711.jpg","142-DSC_0714.jpg","143-DSC_0722.jpg","144-DSC_0725.jpg","145-DSC_0727.jpg","146-DSC_0731.jpg","147-DSC_0733.jpg","148-DSC_0747.jpg","149-DSC_0750.jpg","150-DSC_0752.jpg","151-DSC_0755.jpg","152-DSC_0766.jpg","153-DSC_0767.jpg","154-DSC_0768.jpg","155-DSC_0773.jpg","156-DSC_0784.jpg","157-DSC_0791.jpg","158-DSC_0801.jpg","159-DSC_0804.jpg","160-DSC_0809.jpg","161-DSC_0813.jpg","162-DSC_0827.jpg","163-DSC_0828.jpg","164-DSC_0833.jpg","165-DSC_0834.jpg","166-DSC_0836.jpg","167-DSC_0838.jpg","168-DSC_0840.jpg","170-DSC_0846.jpg","171-DSC_0848.jpg","172-DSC_0855.jpg","173-DSC_0856.jpg","174-DSC_0859.jpg","175-DSC_0860.jpg","177-DSC_0867.jpg","180-DSC_0878.jpg","181-DSC_0879.jpg","183-DSC_0885.jpg","184-DSC_0888.jpg","186-DSC_0892.jpg","187-DSC_0893.jpg","188-DSC_0897.jpg","189-DSC_0900.jpg","190-DSC_0905.jpg","191-DSC_0908.jpg","192-DSC_0911.jpg","193-DSC_0918.jpg","194-DSC_0924.jpg","195-DSC_0933.jpg","196-DSC_0946.jpg","197-DSC_0948.jpg","198-DSC_0949.jpg","199-DSC_0959.jpg","200-DSC_0960.jpg","201-DSC_0974.jpg","202-DSC_0975.jpg","203-DSC_0978.jpg","204-DSC_0985.jpg","205-DSC_0989.jpg","206-DSC_0993.jpg","207-DSC_0995.jpg","208-DSC_0997.jpg","209-DSC_0001.jpg","210-DSC_0023.jpg","212-DSC_0030.jpg","213-DSC_0032.jpg","214-DSC_0038.jpg","215-DSC_0039.jpg","216-DSC_0042.jpg","217-DSC_0043.jpg","218-DSC_0050.jpg","219-DSC_0051.jpg","220-DSC_0054.jpg"];
const ALBUM_U15 = ["IMG_0165.jpeg","IMG_0166.jpeg","IMG_0167.jpeg","IMG_0168.jpeg","IMG_0169.jpeg","IMG_0170.jpeg","IMG_0171.jpeg","IMG_0172.jpeg","IMG_0173.jpeg","IMG_0174.jpeg","IMG_0175.jpeg","IMG_0176.jpeg","IMG_0177.jpeg","IMG_0178.jpeg","IMG_0179.jpeg","IMG_0180.jpeg","IMG_0181.jpeg","IMG_0182.jpeg","IMG_0183.jpeg","IMG_0184.jpeg","IMG_0185.jpeg","IMG_0186.jpeg","IMG_0187.jpeg","IMG_0188.jpeg","IMG_0189.jpeg","IMG_0190.jpeg","IMG_0191.jpeg","IMG_0192.jpeg","IMG_0193.jpeg","IMG_0194.jpeg","IMG_0195.jpeg","IMG_0196.jpeg","IMG_0197.jpeg","IMG_0198.jpeg","IMG_0199.jpeg","IMG_0200.jpeg","IMG_0201.jpeg","IMG_0202.jpeg","IMG_0203.jpeg","IMG_0204.jpeg","IMG_0205.jpeg","IMG_0206.jpeg","IMG_0207.jpeg","IMG_0208.jpeg","IMG_0209.jpeg","IMG_0210.jpeg","IMG_0211.jpeg","IMG_0212.jpeg","IMG_0213.jpeg","IMG_0214.jpeg","IMG_0215.jpeg","IMG_0216.jpeg","IMG_0217.jpeg","IMG_0218.jpeg","IMG_0219.jpeg","IMG_0220.jpeg","IMG_0221.jpeg","IMG_0222.jpeg","IMG_0223.jpeg","IMG_0224.jpeg","IMG_0225.jpeg","IMG_0226.jpeg","IMG_0227.jpeg","IMG_0228.jpeg","IMG_0229.jpeg","IMG_0230.jpeg","IMG_0231.jpeg","IMG_0232.jpeg","IMG_0233.jpeg","IMG_0234.jpeg","IMG_0235.jpeg","IMG_0236.jpeg","IMG_0237.jpeg","IMG_0238.jpeg","IMG_0239.jpeg","IMG_0240.jpeg","IMG_0241.jpeg","IMG_0242.jpeg","IMG_0243.jpeg","IMG_0244.jpeg","IMG_0245.jpeg","IMG_0246.jpeg","IMG_0247.jpeg","IMG_0248.jpeg","IMG_0249.jpeg","IMG_0250.jpeg","IMG_0251.jpeg","IMG_0252.jpeg","IMG_0253.jpeg","IMG_0254.jpeg","IMG_0255.jpeg","IMG_0258.jpeg","IMG_0259.jpeg","IMG_0260.jpeg","IMG_0261.jpeg","IMG_0262.jpeg","IMG_0263.jpeg","IMG_0264.jpeg","IMG_0265.jpeg"];

const ALBUMS = {
  'match-26-04': {
    folder: 'match-26-04',
    title: 'ESI Seniors A vs AS St Jores 2 (7-0)',
    subtitle: 'Sam. 26 avril 2026 · D4 Poule C · Domicile',
    files: ALBUM_MATCH_26_04,
  },
  'u15': {
    folder: 'u15',
    title: 'U15 ESI · Saison 2025-26',
    subtitle: 'Catégorie jeunes · D3 Poule B Printemps',
    files: ALBUM_U15,
  },
};

// Build small preview thumbnails (4 per album, picked spread-out)
function buildPreviews() {
  Object.entries(ALBUMS).forEach(([key, alb]) => {
    const container = document.getElementById('albumPreview-' + key);
    if (!container) return;
    const len = alb.files.length;
    // Pick 4 images spread across the album
    const indexes = [Math.floor(len * 0.1), Math.floor(len * 0.4), Math.floor(len * 0.65), Math.floor(len * 0.9)];
    container.innerHTML = indexes.map(i => {
      const f = alb.files[i];
      return `<img src="assets/gallery/${alb.folder}/${f}" alt="" loading="lazy" data-album="${key}" data-index="${i}">`;
    }).join('');
  });
}
buildPreviews();

// Lightbox
const lightbox = document.getElementById('lightbox');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxCounter = document.getElementById('lightboxCounter');
const lightboxGrid = document.getElementById('lightboxGrid');
const lightboxViewer = document.getElementById('lightboxViewer');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxViewerInfo = document.getElementById('lightboxViewerInfo');

let currentAlbum = null;
let currentIndex = 0;

function openAlbum(key, startIndex = -1) {
  const alb = ALBUMS[key];
  if (!alb) return;
  currentAlbum = key;
  lightboxTitle.textContent = alb.title;
  lightboxCounter.textContent = alb.subtitle + ' · ' + alb.files.length + ' photos';
  // Render full grid (lazy-loaded)
  lightboxGrid.innerHTML = alb.files.map((f, i) =>
    `<img src="assets/gallery/${alb.folder}/${f}" alt="Photo ${i+1}" loading="lazy" data-index="${i}">`
  ).join('');
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (startIndex >= 0) openViewer(startIndex);
  else { lightboxViewer.hidden = true; }
}
function closeLightbox() {
  lightbox.classList.remove('open');
  lightboxViewer.hidden = true;
  document.body.style.overflow = '';
  currentAlbum = null;
}
// Expose globalement pour les onclick inline
window.closeLightbox = closeLightbox;
function openViewer(index) {
  if (!currentAlbum) return;
  const alb = ALBUMS[currentAlbum];
  currentIndex = (index + alb.files.length) % alb.files.length;
  lightboxImg.src = `assets/gallery/${alb.folder}/${alb.files[currentIndex]}`;
  lightboxImg.alt = `Photo ${currentIndex + 1}`;
  lightboxViewerInfo.textContent = `${currentIndex + 1} / ${alb.files.length}`;
  lightboxViewer.hidden = false;
}
function closeViewer() { lightboxViewer.hidden = true; }

document.querySelectorAll('[data-open-album]').forEach(b => {
  b.addEventListener('click', () => openAlbum(b.dataset.openAlbum));
});
// Click on small preview thumbs in album cards → open album at that index
document.querySelectorAll('.album-preview img').forEach(img => {
  img.addEventListener('click', () => openAlbum(img.dataset.album, parseInt(img.dataset.index, 10)));
});
document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxViewerClose').addEventListener('click', closeViewer);
document.getElementById('lightboxPrev').addEventListener('click', () => openViewer(currentIndex - 1));
document.getElementById('lightboxNext').addEventListener('click', () => openViewer(currentIndex + 1));
// Click on grid thumbnail → open viewer at that index
lightboxGrid.addEventListener('click', e => {
  const img = e.target.closest('img');
  if (img) openViewer(parseInt(img.dataset.index, 10));
});
// Keyboard nav
document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') {
    if (!lightboxViewer.hidden) closeViewer();
    else closeLightbox();
  } else if (!lightboxViewer.hidden) {
    if (e.key === 'ArrowLeft') openViewer(currentIndex - 1);
    if (e.key === 'ArrowRight') openViewer(currentIndex + 1);
  }
});
