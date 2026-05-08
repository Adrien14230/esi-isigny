(function() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Defer all polish work until the browser is idle (post-LCP)
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 300));
  idle(() => runPolish());

  function runPolish() {
  // 1) Count-up sur les chiffres de l'info band
  const animateCount = (el, target, duration = 1400) => {
    const start = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(target * easeOut(t));
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = String(target);
    };
    requestAnimationFrame(tick);
  };

  const infoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const txt = el.textContent.trim();
        const num = parseInt(txt, 10);
        if (!Number.isNaN(num) && /^\d+$/.test(txt)) {
          animateCount(el, num);
        }
        infoObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('#info-band .info-value').forEach(el => infoObserver.observe(el));

  // 2) Parallax léger sur le fond hero (translate au scroll)
  const heroBg = document.getElementById('heroBg');
  if (heroBg) {
    let ticking = false;
    const updateParallax = () => {
      const y = window.scrollY;
      // Pas de parallax au-delà du hero (économie CPU)
      if (y < window.innerHeight) {
        heroBg.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
      }
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  }

  // 3) Letter-by-letter — DESKTOP ONLY (skip mobile pour perf)
  const heroTitle = window.innerWidth > 768 ? document.querySelector('.hero-title') : null;
  if (heroTitle && !heroTitle.dataset.split) {
    heroTitle.dataset.split = '1';
    heroTitle.querySelectorAll('span').forEach((line, lineIdx) => {
      const text = line.textContent;
      line.textContent = '';
      [...text].forEach((char, charIdx) => {
        const s = document.createElement('span');
        s.textContent = char === ' ' ? ' ' : char;
        s.style.display = 'inline-block';
        s.style.opacity = '0';
        s.style.transform = 'translateY(0.4em)';
        s.style.transition = `opacity 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${0.2 + lineIdx * 0.08 + charIdx * 0.025}s, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) ${0.2 + lineIdx * 0.08 + charIdx * 0.025}s`;
        line.appendChild(s);
      });
    });
    requestAnimationFrame(() => {
      heroTitle.querySelectorAll('span span').forEach(s => {
        s.style.opacity = '1';
        s.style.transform = 'translateY(0)';
      });
    });
    // Désactive l'anim CSS d'origine pour ne pas qu'elle se cumule
    heroTitle.style.animation = 'none';
  }
  } // end runPolish
})();
