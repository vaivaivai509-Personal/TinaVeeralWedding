/* A scroll-driven rose: native CSS transforms, no libraries or scroll hijacking. */
(() => {
  'use strict';
  const track = document.getElementById('roseTrack');
  const rider = document.getElementById('roseRider');
  const rail = document.getElementById('roseRail');
  const fill = document.getElementById('roseRailFill');
  if (!track || !rider || !rail || !fill) return;
  const rows = Array.from(track.querySelectorAll('.rose-event'));
  if (!rows.length) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let centers = [];
  let start = 0, finish = 1, current = null;
  let frame = 0, previousTime = 0;
  let inView = false;
  let needsMeasure = true;
  let activeRow = -1;

  function measure() {
    const box = track.getBoundingClientRect();
    // The invitation's scratch gate starts with this entire section hidden.
    // Wait for real layout instead of caching a zero-length scroll path.
    if (!box.width || !box.height) return false;
    centers = rows.map(row => {
      const r = row.getBoundingClientRect();
      return r.top - box.top + r.height / 2;
    });
    start = centers[0];
    finish = Math.max(start + 1, centers[centers.length - 1]);
    rail.style.top = start + 'px';
    rail.style.height = (finish - start) + 'px';
    current = current === null ? start : clamp(current, start, finish);
    needsMeasure = false;
    track.classList.add('is-ready');
    return true;
  }

  function markCurrent(position) {
    let closest = 0;
    for (let i = 1; i < centers.length; i++) {
      if (Math.abs(centers[i] - position) < Math.abs(centers[closest] - position)) closest = i;
    }
    if (closest === activeRow) return;
    activeRow = closest;
    rows.forEach((row, index) => {
      row.classList.toggle('is-current', index === closest);
      row.classList.toggle('is-past', index < closest);
      if (index === closest) row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
    });
  }

  function draw(now) {
    frame = 0;
    if (document.hidden) return;
    if (needsMeasure && !measure()) return;
    const box = track.getBoundingClientRect();
    if (!box.height) { needsMeasure = true; return; }
    const viewport = window.innerHeight;
    const anchor = clamp(viewport * .52, 120, Math.max(120, viewport - 80));
    const target = clamp(anchor - box.top, start, finish);
    const dt = previousTime ? Math.min(50, now - previousTime) : 16;
    previousTime = now;
    if (reducedMotion.matches) current = start;
    else if (!inView) current = target;
    else current += (target - current) * (1 - Math.exp(-dt / 52));
    if (Math.abs(target - current) < .15 && !reducedMotion.matches) current = target;
    const progress = clamp((current - start) / (finish - start), 0, 1);
    rider.style.setProperty('--rose-y', current.toFixed(2) + 'px');
    rider.style.setProperty('--rose-turn', (reducedMotion.matches ? -20 : -20 + progress * 720).toFixed(2) + 'deg');
    fill.style.setProperty('--rose-progress', progress.toFixed(5));
    markCurrent(reducedMotion.matches ? target : current);
    if (inView && !reducedMotion.matches && Math.abs(target - current) > .15) requestDraw();
  }

  function requestDraw() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function updateLayout() { needsMeasure = true; previousTime = 0; requestDraw(); }

  window.addEventListener('scroll', () => { if (inView) requestDraw(); }, { passive: true });
  window.addEventListener('resize', updateLayout, { passive: true });
  window.addEventListener('pageshow', updateLayout);
  if ('ResizeObserver' in window) new ResizeObserver(updateLayout).observe(track);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      track.classList.toggle('in-view', inView && !document.hidden);
      previousTime = 0;
      if (inView) updateLayout();
      else { cancelAnimationFrame(frame); frame = 0; }
    }, { rootMargin: '100px 0px', threshold: 0 }).observe(track);
  } else {
    // ResizeObserver is not essential. Attribute observation also handles the
    // scratch gate opening on browsers without either layout observer.
    inView = true;
    track.classList.add('in-view');
  }
  if ('MutationObserver' in window) {
    new MutationObserver(updateLayout).observe(document.getElementById('celebrations'), {
      attributes: true, attributeFilter: ['hidden']
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateLayout);
  reducedMotion.addEventListener('change', updateLayout);
  document.addEventListener('visibilitychange', () => {
    track.classList.toggle('in-view', inView && !document.hidden);
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else updateLayout();
  });
  updateLayout();
})();
