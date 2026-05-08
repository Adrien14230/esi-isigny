// ===== COOKIE CONSENT (RGPD/CNIL) =====
(function() {
  const CONSENT_KEY = 'esi-cookie-consent-v1';
  const banner = document.getElementById('cookieBanner');
  const modal = document.getElementById('cookieModal');
  const toggleAnalytics = document.getElementById('toggleAnalytics');
  const toggleSocial = document.getElementById('toggleSocial');

  function readConsent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); }
    catch { return null; }
  }
  function writeConsent(consent) {
    consent.timestamp = new Date().toISOString();
    consent.version = 1;
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    applyConsent(consent);
  }
  function applyConsent(consent) {
    // Hooks pour appliquer les choix : si plus tard tu ajoutes Google Analytics ou
    // un script Facebook Pixel, c'est ici qu'il faut les charger conditionnellement.
    // Exemple: if (consent.analytics) loadGoogleAnalytics();
    if (consent.analytics) console.info('[Cookies] Analytics activés');
    if (consent.social) console.info('[Cookies] Médias sociaux activés');
  }
  function showBanner() { banner.classList.add('visible'); }
  function hideBanner() { banner.classList.remove('visible'); }

  // Helpers globaux pour les onclick inline
  window.acceptAllCookies = function() {
    writeConsent({ essential: true, analytics: true, social: true });
    hideBanner();
    closeCookieSettings();
  };
  window.rejectAllCookies = function() {
    writeConsent({ essential: true, analytics: false, social: false });
    hideBanner();
    closeCookieSettings();
  };
  window.openCookieSettings = function() {
    const c = readConsent() || { essential: true, analytics: false, social: false };
    toggleAnalytics.classList.toggle('active', !!c.analytics);
    toggleAnalytics.setAttribute('aria-checked', String(!!c.analytics));
    toggleSocial.classList.toggle('active', !!c.social);
    toggleSocial.setAttribute('aria-checked', String(!!c.social));
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.closeCookieSettings = function() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  };
  window.saveCookiePreferences = function() {
    writeConsent({
      essential: true,
      analytics: toggleAnalytics.classList.contains('active'),
      social: toggleSocial.classList.contains('active'),
    });
    hideBanner();
    closeCookieSettings();
  };
  window.toggleCookieCategory = function(cat) {
    const t = cat === 'analytics' ? toggleAnalytics : toggleSocial;
    t.classList.toggle('active');
    t.setAttribute('aria-checked', String(t.classList.contains('active')));
  };

  // Click-out sur le backdrop ferme le modal
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeCookieSettings();
  });
  // Escape pour fermer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeCookieSettings();
  });

  // Au chargement : montre le banner si aucun consentement enregistré
  const stored = readConsent();
  if (!stored) {
    // Petit délai pour ne pas montrer immédiatement (UX moins agressif)
    setTimeout(showBanner, 800);
  } else {
    applyConsent(stored);
  }
})();
