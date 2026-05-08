// ===== PWA Install + Service Worker =====
(function setupPWA() {
  // 1. Enregistrement du Service Worker (cache offline + installation)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.info('[PWA] Service Worker enregistré, scope:', reg.scope);
          // Si nouvelle version dispo → on l'active automatiquement
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.info('[PWA] Nouvelle version dispo, activation...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));
    });
    // Reload la page quand le nouveau SW prend le contrôle
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // 2. Bouton "Installer l'app" custom
  const installBtn = document.getElementById('pwaInstallBtn');
  let deferredPrompt = null;

  // Le browser nous donne un prompt d'install qu'on peut déclencher quand on veut
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.info('[PWA] User choice:', outcome);
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  }

  // Cache l'installation : si déjà installée, on cache le bouton
  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.hidden = true;
    console.info('[PWA] App installée 🎉');
  });
})();
