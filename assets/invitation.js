/* Veeral & Tina — dependency-free invitation, works from a folder or web host. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const opening = $('opening');
  const invitation = $('invitation');
  const music = $('music');
  const magic = $('magicSound');
  const musicButton = $('musicButton');
  const musicLabel = $('musicLabel');
  let hasOpened = false;
  let openingStarted = false;
  let wantsMusic = true;
  let audioContext = null;
  let musicGain = null;
  let musicTimer = 0;
  let noticeTimer = 0;
  let canPlayMusic = false;
  const musicLevel = 0.46;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  invitation.inert = true;
  invitation.setAttribute('aria-hidden', 'true');

  function showAudioNotice(text) {
    const notice = $('audioNotice');
    notice.textContent = text;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => { notice.hidden = true; }, 6000);
  }
  function updateMusicButton() {
    const on = wantsMusic && !music.paused;
    musicButton.classList.toggle('is-muted', !on);
    musicButton.setAttribute('aria-pressed', String(!on));
    musicButton.setAttribute('aria-label', on ? 'Mute music' : 'Play music');
    musicLabel.textContent = on ? 'Music on' : 'Music off';
  }
  function buildMusicGraph() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    // file:// media can be treated as an opaque origin by Web Audio. Use the
    // native audio element for a downloaded folder, and gain control on a host.
    if (location.protocol === 'file:') return;
    if (!Audio || audioContext) return;
    try {
      audioContext = new Audio();
      musicGain = audioContext.createGain();
      musicGain.gain.value = 0;
      audioContext.createMediaElementSource(music).connect(musicGain);
      musicGain.connect(audioContext.destination);
    } catch (_) { musicGain = null; }
  }
  function beginSound() {
    // Both play() calls and AudioContext.resume() belong to the envelope gesture.
    // Music is routed through a silent gain until the flap has opened.
    buildMusicGraph();
    if (audioContext) audioContext.resume().catch(() => {});
    if (!musicGain) { music.muted = true; music.volume = musicLevel; }
    magic.volume = 0.65;
    magic.play().catch(() => {});
    music.play().then(() => {
      canPlayMusic = true;
      updateMusicButton();
    }).catch(() => {
      canPlayMusic = false;
      wantsMusic = false;
      updateMusicButton();
      showAudioNotice('Tap Music off to start the music.');
    });
    musicTimer = window.setTimeout(() => {
      if (!wantsMusic) return;
      if (musicGain) {
        const now = audioContext.currentTime;
        musicGain.gain.cancelScheduledValues(now);
        musicGain.gain.setValueAtTime(0, now);
        musicGain.gain.linearRampToValueAtTime(musicLevel, now + 2.0);
      } else { music.muted = false; }
    }, reducedMotion.matches ? 700 : 2250);
  }
  function finishOpening() {
    if (hasOpened) return;
    hasOpened = true;
    invitation.inert = false;
    invitation.removeAttribute('aria-hidden');
    document.body.classList.remove('sealed');
    document.body.classList.add('opened');
    opening.classList.add('is-gone');
    opening.setAttribute('aria-hidden', 'true');
    opening.inert = true;
    window.scrollTo(0, 0);
    $('coupleTitle').focus({ preventScroll: true });
    if (reducedMotion.matches) $('lightSpread').classList.remove('is-lit');
    window.setTimeout(() => { opening.hidden = true; }, 800);
    updateMusicButton();
    updateScroll();
  }
  $('openEnvelope').addEventListener('click', () => {
    if (openingStarted) return;
    openingStarted = true;
    $('openEnvelope').disabled = true;
    opening.classList.add('is-opening');
    beginSound();
    window.setTimeout(() => $('lightSpread').classList.add('is-lit'), reducedMotion.matches ? 250 : 900);
    window.setTimeout(finishOpening, reducedMotion.matches ? 650 : 2450);
    window.setTimeout(() => { $('lightSpread').classList.remove('is-lit'); }, reducedMotion.matches ? 1100 : 3750);
  });
  // Keep keyboard focus inside the sealed envelope screen until it opens.
  opening.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); $('openEnvelope').focus(); }
  });

  musicButton.addEventListener('click', () => {
    if (!hasOpened) return;
    if (wantsMusic && !music.paused) {
      wantsMusic = false;
      clearTimeout(musicTimer);
      if (musicGain) {
        musicGain.gain.cancelScheduledValues(audioContext.currentTime);
        musicGain.gain.setValueAtTime(0, audioContext.currentTime);
      }
      music.pause();
      magic.pause();
      updateMusicButton();
    } else {
      wantsMusic = true;
      if (audioContext) audioContext.resume().catch(() => {});
      if (musicGain) {
        musicGain.gain.cancelScheduledValues(audioContext.currentTime);
        musicGain.gain.setValueAtTime(musicLevel, audioContext.currentTime);
      }
      music.muted = false;
      music.play().then(() => {
        canPlayMusic = true;
        $('audioNotice').hidden = true;
        updateMusicButton();
      }).catch(() => {
        wantsMusic = false;
        showAudioNotice('Music could not load. Please keep the assets folder beside index.html.');
        updateMusicButton();
      });
    }
  });
  music.addEventListener('pause', updateMusicButton);
  music.addEventListener('play', updateMusicButton);
  music.addEventListener('error', () => {
    wantsMusic = false;
    if (hasOpened) showAudioNotice('Music could not load. You can still enjoy the invitation.');
    updateMusicButton();
  });
  document.addEventListener('visibilitychange', () => {
    if (!hasOpened) return;
    if (document.hidden) music.pause();
    else if (wantsMusic && canPlayMusic) {
      if (audioContext) audioContext.resume().catch(() => {});
      music.play().catch(() => updateMusicButton());
    }
  });

  // Scratch layer: sample only points inside the painted heart, never its clear corners.
  const scratch = $('scratchCanvas');
  const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
  let dateRevealed = false;
  let dragging = false;
  let lastPoint = null;
  let samples = [];
  let lastCoverageCheck = 0;
  const heartPath = new Path2D('M180 305C152 280 20 186 20 105C20 25 128 0 180 76C232 0 340 25 340 105C340 186 208 280 180 305Z');
  function drawScratchLayer() {
    if (!scratchContext) return;
    const c = scratchContext;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, 360, 330);
    c.save(); c.clip(heartPath);
    const gradient = c.createLinearGradient(15, 40, 320, 260);
    gradient.addColorStop(0, '#b98b3e'); gradient.addColorStop(0.34, '#f3dda0'); gradient.addColorStop(0.62, '#d2ad61'); gradient.addColorStop(1, '#916225');
    c.fillStyle = gradient; c.fillRect(0, 0, 360, 330);
    // Deterministic, fine metallic texture, so no downloaded texture is needed.
    let seed = 27;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 4800; i++) {
      c.fillStyle = random() > .6 ? 'rgba(255,239,215,.35)' : 'rgba(94,45,12,.16)';
      c.beginPath(); c.arc(random() * 360, random() * 330, random() * .85 + .25, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = 'rgba(249,224,187,.38)'; c.lineWidth = .65;
    for (const scale of [.91, .85]) {
      c.save(); c.translate(180, 150); c.scale(scale, scale); c.translate(-180, -150); c.stroke(heartPath); c.restore();
    }
    c.textAlign = 'center'; c.fillStyle = '#4b1025';
    c.font = '12px Georgia'; c.fillText('✧', 180, 105);
    c.font = 'italic 24px Georgia'; c.fillText('a little', 180, 145);
    c.font = 'italic 38px Georgia'; c.fillText('forever', 180, 184);
    c.font = '9px Arial'; c.fillStyle = '#4b1025'; c.fillText('S C R A T C H  T O  R E V E A L', 180, 213);
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    const pixels = c.getImageData(0, 0, scratch.width, scratch.height).data;
    samples = [];
    for (let y = 0; y < scratch.height; y += 12) for (let x = 0; x < scratch.width; x += 12) {
      const i = (y * scratch.width + x) * 4 + 3;
      if (pixels[i] > 180) samples.push(i);
    }
  }
  function pointAt(event) {
    const r = scratch.getBoundingClientRect();
    return { x: (event.clientX - r.left) * scratch.width / r.width, y: (event.clientY - r.top) * scratch.height / r.height };
  }
  function paintScratch(event) {
    if (!dragging || dateRevealed || !scratchContext) return;
    const p = pointAt(event), c = scratchContext;
    c.globalCompositeOperation = 'destination-out';
    c.lineWidth = 53 * scratch.width / scratch.getBoundingClientRect().width;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(lastPoint ? lastPoint.x : p.x, lastPoint ? lastPoint.y : p.y); c.lineTo(p.x, p.y); c.stroke();
    c.beginPath(); c.arc(p.x, p.y, c.lineWidth / 2, 0, Math.PI * 2); c.fill();
    lastPoint = p;
    if (performance.now() - lastCoverageCheck > 90) { checkCoverage(); lastCoverageCheck = performance.now(); }
  }
  function checkCoverage() {
    if (dateRevealed || !scratchContext || !samples.length) return;
    const data = scratchContext.getImageData(0, 0, scratch.width, scratch.height).data;
    let erased = 0;
    for (const point of samples) if (data[point] < 100) erased++;
    if (erased / samples.length >= .38) revealDate();
  }
  scratch.addEventListener('pointerdown', event => {
    if (dateRevealed || event.button > 0) return;
    dragging = true; lastPoint = null;
    scratch.setPointerCapture(event.pointerId);
    paintScratch(event);
  });
  scratch.addEventListener('pointermove', paintScratch);
  function endScratch() { dragging = false; lastPoint = null; checkCoverage(); }
  scratch.addEventListener('pointerup', endScratch);
  scratch.addEventListener('pointercancel', endScratch);
  scratch.addEventListener('lostpointercapture', endScratch);
  function revealDate() {
    if (dateRevealed) return;
    dateRevealed = true; dragging = false;
    $('scratchHeart').classList.add('revealed');
    $('revealedDate').removeAttribute('aria-hidden');
    scratch.setAttribute('aria-hidden', 'true');
    $('scratchHint').textContent = 'Our forever begins on 2 December 2026';
    $('revealDate').disabled = true;
    $('dateAfter').hidden = false;
    $('dateAnnouncement').textContent = 'Wedding date revealed: 2 December 2026. Celebrations on the 1st and 2nd of December 2026.';
    rainPetals();
    if (!reducedMotion.matches && wantsMusic && audioContext && audioContext.state === 'running') {
      [783.991, 1046.502, 1318.51].forEach((f, i) => {
        const o = audioContext.createOscillator(), gain = audioContext.createGain();
        const at = audioContext.currentTime + i * .14;
        o.frequency.value = f; o.type = 'sine';
        gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.045, at + .02); gain.gain.exponentialRampToValueAtTime(.001, at + 1.3);
        o.connect(gain); gain.connect(musicGain || audioContext.destination); o.start(at); o.stop(at + 1.4);
        o.onended = () => { o.disconnect(); gain.disconnect(); };
      });
    }
    scrollDirty = true;
  }
  $('revealDate').addEventListener('click', revealDate);
  drawScratchLayer();

  // A short shower of maroon, gold and champagne petals; no perpetual rendering loop.
  const petalCanvas = $('petals');
  const petalContext = petalCanvas.getContext('2d');
  let petalFrame = 0;
  let petalEnd = 0;
  function rainPetals() {
    if (reducedMotion.matches || !petalContext) return;
    cancelAnimationFrame(petalFrame);
    const width = window.innerWidth, height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    petalCanvas.width = Math.round(width * pixelRatio); petalCanvas.height = Math.round(height * pixelRatio);
    petalContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    petalCanvas.classList.add('active');
    const palette = [['#ba5367','#65132d'],['#efce88','#b88a3e'],['#f7e5be','#c5a05b'],['#f5d8bd','#d1a772']];
    const petals = Array.from({ length: width < 600 ? 80 : 125 }, () => ({
      x: Math.random() * width, y: -30 - Math.random() * height * 1.35,
      speed: 65 + Math.random() * 70, size: 7 + Math.random() * 7,
      turn: Math.random() * Math.PI * 2, spin: (Math.random() - .5) * 2,
      drift: 16 + Math.random() * 28, phase: Math.random() * 8,
      color: palette[Math.floor(Math.random() * palette.length)]
    }));
    const start = performance.now(); let previous = start; petalEnd = start + 11500;
    function frame(now) {
      const dt = Math.min((now - previous) / 1000, .05); previous = now;
      const c = petalContext; c.clearRect(0, 0, width, height);
      const opacity = Math.min(1, (petalEnd - now) / 1600);
      if (now >= petalEnd) { petalCanvas.classList.remove('active'); c.clearRect(0, 0, width, height); return; }
      for (const p of petals) {
        p.y += p.speed * dt; p.turn += p.spin * dt;
        const x = p.x + Math.sin(now / 1200 + p.phase) * p.drift;
        if (p.y < -30 || p.y > height + 30) continue;
        c.save(); c.globalAlpha = Math.max(0, opacity) * .86; c.translate(x, p.y); c.rotate(p.turn); c.scale(Math.max(.23, Math.abs(Math.cos(now / 750 + p.phase))), 1);
        const gradient = c.createLinearGradient(-p.size, -p.size, p.size, p.size);
        gradient.addColorStop(0, p.color[0]); gradient.addColorStop(1, p.color[1]);
        c.fillStyle = gradient; c.beginPath(); c.moveTo(0, -p.size); c.bezierCurveTo(p.size * 1.25, -p.size * .8, p.size * 1.25, p.size * .55, 0, p.size); c.bezierCurveTo(-p.size * .7, p.size * .4, -p.size * .8, -p.size * .6, 0, -p.size); c.fill();
        c.strokeStyle = '#ffffff40'; c.lineWidth = .65; c.beginPath(); c.moveTo(0, -p.size * .8); c.quadraticCurveTo(p.size * .3, 0, 0, p.size * .7); c.stroke(); c.restore();
      }
      petalFrame = requestAnimationFrame(frame);
    }
    petalFrame = requestAnimationFrame(frame);
  }

  const weddingDate = new Date('2026-12-02T00:00:00+05:30').getTime();
  function countdown() {
    const left = Math.max(0, weddingDate - Date.now());
    $('days').textContent = String(Math.floor(left / 86400000)).padStart(2, '0');
    $('hours').textContent = String(Math.floor(left / 3600000) % 24).padStart(2, '0');
    $('minutes').textContent = String(Math.floor(left / 60000) % 60).padStart(2, '0');
    $('seconds').textContent = String(Math.floor(left / 1000) % 60).padStart(2, '0');
    if (!left) $('countdownHeading').textContent = Date.now() < weddingDate + 86400000 ? 'Today, our forever begins' : 'A beautiful beginning, forever in our hearts';
  }
  countdown(); window.setInterval(countdown, 1000);

  // Multiple distinct scroll entrances, plus quiet background parallax.
  const reveals = Array.from(document.querySelectorAll('[data-reveal]'));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -24px 0px' });
    reveals.forEach(el => observer.observe(el));
  } else reveals.forEach(el => el.classList.add('is-visible'));
  const parallax = Array.from(document.querySelectorAll('[data-parallax]'));
  const navLinks = Array.from(document.querySelectorAll('.topbar nav a'));
  let scrollDirty = false, scrollFrame = 0;
  function updateScroll() {
    scrollFrame = 0;
    if (!hasOpened) return;
    const y = window.scrollY, view = window.innerHeight;
    const max = document.documentElement.scrollHeight - view;
    $('readingProgress').style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (!reducedMotion.matches) for (const el of parallax) {
      const rect = el.parentElement.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < view) el.style.transform = `translateY(${Math.max(-65, Math.min(65, -rect.top * Number(el.dataset.parallax)))}px)`;
    }
    let active = null;
    for (const link of navLinks) {
      const section = document.querySelector(link.getAttribute('href'));
      if (section.getBoundingClientRect().top < view * .45) active = link;
    }
    navLinks.forEach(link => { link.classList.toggle('active', link === active); if (link === active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
    scrollDirty = false;
  }
  function requestScrollUpdate() { scrollDirty = true; if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }
  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', () => { requestScrollUpdate(); if (petalCanvas.classList.contains('active')) { cancelAnimationFrame(petalFrame); petalCanvas.classList.remove('active'); } }, { passive: true });

  const track = $('galleryTrack');
  function moveGallery(direction) { track.scrollBy({ left: direction * (track.querySelector('.memory-photo').offsetWidth + 28), behavior: reducedMotion.matches ? 'auto' : 'smooth' }); }
  $('galleryPrev').addEventListener('click', () => moveGallery(-1));
  $('galleryNext').addEventListener('click', () => moveGallery(1));
  const photos = Array.from(document.querySelectorAll('.memory-photo'));
  const lightbox = $('lightbox'); let currentPhoto = 0; let photoTrigger = null;
  function displayPhoto(index) {
    currentPhoto = (index + photos.length) % photos.length;
    const selected = photos[currentPhoto], img = selected.querySelector('img');
    $('lightboxImage').src = img.getAttribute('src'); $('lightboxImage').alt = img.alt;
    $('lightboxCaption').textContent = selected.querySelector('span').textContent;
  }
  photos.forEach((photo, index) => photo.addEventListener('click', () => {
    displayPhoto(index); photoTrigger = photo;
    if (typeof lightbox.showModal === 'function') { lightbox.showModal(); document.body.classList.add('gallery-open'); }
    else window.open(photo.querySelector('img').src, '_blank', 'noopener');
  }));
  function closePhoto() { lightbox.close(); }
  $('closeLightbox').addEventListener('click', closePhoto);
  lightbox.addEventListener('close', () => { document.body.classList.remove('gallery-open'); if (photoTrigger) photoTrigger.focus({ preventScroll: true }); });
  $('photoPrev').addEventListener('click', () => displayPhoto(currentPhoto - 1));
  $('photoNext').addEventListener('click', () => displayPhoto(currentPhoto + 1));
  lightbox.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') { event.preventDefault(); displayPhoto(currentPhoto - 1); } if (event.key === 'ArrowRight') { event.preventDefault(); displayPhoto(currentPhoto + 1); } });
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closePhoto(); });
  $('replayInvitation').addEventListener('click', () => { music.pause(); if (history.replaceState) history.replaceState(null, '', location.pathname + location.search); window.scrollTo(0, 0); location.reload(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { cancelAnimationFrame(petalFrame); petalCanvas.classList.remove('active'); } });
})();
