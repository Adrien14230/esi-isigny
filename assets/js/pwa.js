// ===== PWA Install + Service Worker =====
// IMPORTANT: SW DÉSACTIVÉ TEMPORAIREMENT — il cachait les vieilles versions des JS
// et empêchait les utilisateurs de voir les mises à jour des données FFF.
// On unregister tous les SW existants au load pour purger.
(function setupPWA() {
  // Unregister tout SW existant ET force reload pour purger complètement
  if ('serviceWorker' in navigator) {
    const hadSW = !!navigator.serviceWorker.controller;
    Promise.all([
      navigator.serviceWorker.getRegistrations().then((regs) =>
        Promise.all(regs.map((reg) => reg.unregister()))
      ),
      window.caches ? caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.delete(n)))
      ) : Promise.resolve(),
    ]).then(() => {
      console.info('[PWA] SW + caches purgés');
      // Si la page était contrôlée par un SW, on reload UNE fois pour bypass
      if (hadSW && !sessionStorage.getItem('sw-purged')) {
        sessionStorage.setItem('sw-purged', '1');
        console.info('[PWA] Reload pour appliquer la purge');
        window.location.reload();
      }
    });
  }

  // Bouton "Installer l'app" custom — désactivé sans SW
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) installBtn.hidden = true;
})();
