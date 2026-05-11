// ===== PWA Install + Service Worker =====
// IMPORTANT: SW DÉSACTIVÉ TEMPORAIREMENT — il cachait les vieilles versions des JS
// et empêchait les utilisateurs de voir les mises à jour des données FFF.
// On unregister tous les SW existants au load pour purger.
(function setupPWA() {
  // Unregister tout SW existant (purge cache pour tous les users)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) {
        reg.unregister().then(() => console.info('[PWA] SW unregistered:', reg.scope));
      }
    });
    // Vide aussi tous les caches
    if (window.caches) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
  }

  // Bouton "Installer l'app" custom — désactivé sans SW
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) installBtn.hidden = true;
})();
