/* A sky of golden wishes — canvas lanterns, fireworks and heart confetti.
   Local, dependency-free, bounded to nine seconds and started by a guest's tap. */
(() => {
  'use strict';
  const canvas = document.getElementById('celebrationCanvas');
  const button = document.getElementById('celebrateLove');
  const label = button.querySelector('span');
  const hint = document.getElementById('celebrationHint');
  const message = document.getElementById('celebrationMessage');
  const section = document.getElementById('rsvp');
  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 9200;
  const palette = ['#fbe9b7', '#e8bf70', '#fff2ce', '#d79a8e'];
  let frameId = 0;
  let running = false;
  let played = false;
  let width = 0;
  let height = 0;
  let startTime = 0;
  let lastTime = 0;
  let lanterns = [];
  let hearts = [];
  let sparks = [];
  let bursts = [];

  button.setAttribute('aria-pressed', 'false');

  // Render the softly illuminated paper lantern once; reuse it at different depths.
  const lanternArt = document.createElement('canvas');
  lanternArt.width = 100;
  lanternArt.height = 128;
  const art = lanternArt.getContext('2d');
  if (art) {
    const halo = art.createRadialGradient(50, 68, 3, 50, 68, 47);
    halo.addColorStop(0, 'rgba(255,213,117,.45)');
    halo.addColorStop(.46, 'rgba(239,183,68,.19)');
    halo.addColorStop(1, 'rgba(239,183,68,0)');
    art.fillStyle = halo;
    art.fillRect(0, 0, 100, 128);
    const silk = art.createLinearGradient(30, 40, 69, 81);
    silk.addColorStop(0, '#ce9b49');
    silk.addColorStop(.24, '#f7df99');
    silk.addColorStop(.52, '#fff4c7');
    silk.addColorStop(.78, '#e7bf6d');
    silk.addColorStop(1, '#b88333');
    art.fillStyle = silk;
    art.strokeStyle = 'rgba(255,233,165,.72)';
    art.lineWidth = 1;
    art.beginPath();
    art.moveTo(31, 42);
    art.quadraticCurveTo(50, 35, 69, 42);
    art.bezierCurveTo(72, 55, 66, 73, 61, 83);
    art.quadraticCurveTo(50, 88, 39, 83);
    art.bezierCurveTo(33, 73, 28, 55, 31, 42);
    art.fill();
    art.stroke();
    art.strokeStyle = 'rgba(156,101,36,.33)';
    for (const x of [39, 50, 61]) {
      art.beginPath();
      art.moveTo(x, 42);
      art.quadraticCurveTo(x + (50 - x) * .18, 64, x + (50 - x) * .4, 82);
      art.stroke();
    }
    art.fillStyle = '#bc863b';
    art.beginPath();
    art.ellipse(50, 83, 10, 2.5, 0, 0, Math.PI * 2);
    art.fill();
    const flame = art.createRadialGradient(50, 77, 0, 50, 77, 13);
    flame.addColorStop(0, '#fffcea');
    flame.addColorStop(.25, '#ffedb1');
    flame.addColorStop(1, 'rgba(255,212,98,0)');
    art.fillStyle = flame;
    art.fillRect(36, 63, 28, 30);
  }

  function stopCelebration() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    running = false;
    canvas.classList.remove('active');
    button.classList.remove('is-celebrating');
    button.setAttribute('aria-pressed', 'false');
    label.textContent = 'Shower us with love';
    hint.textContent = played ? 'Tap to celebrate again' : 'Tap for a little celebration';
    if (context) context.clearRect(0, 0, width, height);
    lanterns = [];
    hearts = [];
    sparks = [];
    bursts = [];
  }

  function burst(x, y, count, speed = 1) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * .09;
      const force = (35 + Math.random() * 70) * speed;
      sparks.push({
        x, y, previousX: x, previousY: y,
        vx: Math.cos(angle) * force, vy: Math.sin(angle) * force,
        age: 0, life: 1.3 + Math.random() * 1.2,
        size: .6 + Math.random() * 1.1,
        color: palette[i % 3], phase: Math.random() * 6
      });
    }
  }

  function heartShape(c, size) {
    c.beginPath();
    c.moveTo(0, size * .65);
    c.bezierCurveTo(-size * 1.2, -.1 * size, -size * .65, -size, 0, -size * .35);
    c.bezierCurveTo(size * .65, -size, size * 1.2, -.1 * size, 0, size * .65);
    c.closePath();
  }

  function animate(now) {
    if (!running) return;
    const elapsed = now - startTime;
    const dt = Math.min((now - lastTime) / 1000, .04);
    lastTime = now;
    if (elapsed >= duration) { stopCelebration(); return; }
    const c = context;
    c.clearRect(0, 0, width, height);
    const fade = Math.min(1, (duration - elapsed) / 1600);

    // A staggered release, with nearer lanterns rising a little faster.
    for (const item of lanterns) {
      const age = (elapsed - item.delay) / 1000;
      if (age < 0) continue;
      const y = height + 38 - age * item.speed;
      if (y < -75) continue;
      const x = item.x + Math.sin(age * .8 + item.phase) * item.drift;
      const scale = item.size;
      c.save();
      c.globalAlpha = item.opacity * fade * Math.min(1, age * 2);
      c.translate(x, y);
      c.rotate(Math.sin(age * .8 + item.phase) * .11);
      c.drawImage(lanternArt, -50 * scale, -64 * scale, 100 * scale, 128 * scale);
      c.restore();
    }

    for (const item of bursts) {
      if (!item.fired && elapsed >= item.at) {
        item.fired = true;
        burst(item.x * width, item.y * height, width < 600 ? 34 : 54, item.scale);
      }
    }

    // Tiny gold trails keep the fireworks soft enough for the invitation to read.
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of sparks) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.previousX = p.x;
      p.previousY = p.y;
      p.vx *= Math.exp(-1.2 * dt);
      p.vy = p.vy * Math.exp(-1.2 * dt) + 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      c.globalAlpha = Math.pow(1 - p.age / p.life, 1.3) * fade;
      c.strokeStyle = p.color;
      c.lineWidth = p.size;
      c.beginPath();
      c.moveTo(p.previousX - p.vx * .035, p.previousY - p.vy * .035);
      c.lineTo(p.x, p.y);
      c.stroke();
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size * (.75 + .25 * Math.sin(p.age * 12 + p.phase)), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    sparks = sparks.filter(p => p.age < p.life);

    for (const p of hearts) {
      const age = elapsed / 1000 - p.delay;
      if (age < 0 || age > p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-1.35 * dt);
      p.vy += 35 * dt;
      p.angle += p.spin * dt;
      c.save();
      c.globalAlpha = fade * Math.min(1, age * 7, (p.life - age) * 1.6) * .9;
      c.translate(p.x + Math.sin(age * 2 + p.phase) * 12, p.y);
      c.rotate(p.angle);
      c.scale(.4 + Math.abs(Math.cos(age * 2.3 + p.phase)) * .6, 1);
      c.fillStyle = p.color;
      heartShape(c, p.size);
      c.fill();
      c.restore();
    }
    frameId = requestAnimationFrame(animate);
  }

  function startCelebration() {
    if (running) { stopCelebration(); return; }
    played = true;
    message.textContent = 'Here’s to love, laughter and a beautiful forever.';
    if (reducedMotion.matches || !context || !art) {
      hint.textContent = 'A little love, from us to you';
      return;
    }
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const small = width < 600;
    const buttonRect = button.getBoundingClientRect();
    const origin = {
      x: Math.max(30, Math.min(width - 30, buttonRect.left + buttonRect.width / 2)),
      y: Math.max(40, Math.min(height - 50, buttonRect.top + buttonRect.height / 2))
    };
    const count = small ? 18 : 32;
    lanterns = Array.from({ length: count }, (_, i) => ({
      x: ((i + .3 + Math.random() * .4) / count) * width,
      delay: 380 + Math.random() * 2350,
      speed: height / (6.5 + Math.random() * 3.8),
      size: (small ? .30 : .34) + Math.random() * .30,
      opacity: .50 + Math.random() * .43,
      drift: 10 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2
    }));
    hearts = Array.from({ length: small ? 42 : 68 }, (_, i) => ({
      x: origin.x + (Math.random() - .5) * 28,
      y: origin.y,
      vx: (Math.random() - .5) * (small ? 420 : 740),
      vy: -145 - Math.random() * 160,
      delay: Math.random() * .75,
      life: 4.4 + Math.random() * 2.7,
      size: 3 + Math.random() * 4,
      spin: (Math.random() - .5) * 3,
      angle: Math.random() * 6,
      phase: Math.random() * 6,
      color: palette[i % palette.length]
    }));
    sparks = [];
    bursts = [
      { at: 120, x: .16, y: .27, scale: .85 },
      { at: 670, x: .85, y: .36, scale: 1.05 },
      { at: 1900, x: .21, y: .58, scale: .72 },
      { at: 3000, x: .77, y: .20, scale: .9 },
      { at: 4450, x: .12, y: .40, scale: .7 },
      { at: 5350, x: .88, y: .50, scale: .8 }
    ];
    running = true;
    button.setAttribute('aria-pressed', 'true');
    button.classList.add('is-celebrating');
    label.textContent = 'Stop the celebration';
    hint.textContent = 'A sky full of golden wishes';
    canvas.classList.add('active');
    startTime = performance.now();
    lastTime = startTime;
    frameId = requestAnimationFrame(animate);
  }

  button.addEventListener('click', startCelebration);
  window.addEventListener('resize', () => { if (running) stopCelebration(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCelebration(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopCelebration(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (running && !entries[0].isIntersecting) stopCelebration();
    }).observe(section);
  }
})();
