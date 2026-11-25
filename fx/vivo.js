/* Ambiente da ficha: uma fita torcida e partículas que desviam do ponteiro. */
export function criar({ gsap }) {
  const host = document.getElementById('vivo');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx || !host) return null;
  host.append(canvas);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: -1000, y: -1000 };
  const dust = Array.from({ length: 125 }, () => ({
    x: Math.random(),
    y: Math.random(),
    phase: Math.random() * Math.PI * 2,
    size: 0.5 + Math.random() * 1.1,
  }));
  let width,
    height,
    accent,
    light,
    last = 0,
    time = 0,
    pulse = 0;
  function resize() {
    width = host.clientWidth;
    height = host.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function theme() {
    accent = getComputedStyle(document.documentElement).getPropertyValue('--pri-rgb').trim();
    light = document.body.classList.contains('claro');
  }
  function point(angle, side) {
    const twist = angle * 1.5 + time * 0.39;
    const radius = 1 + side * 0.22 * Math.cos(twist);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return {
      x,
      z,
      y: 0.28 * z + 0.18 * Math.sin(2 * angle + time * 0.32) + side * 0.22 * Math.sin(twist) - 0.1 * x,
    };
  }
  function drawRibbon() {
    const size = Math.min(width * 0.17, height * 0.72);
    const cx = width * 0.74,
      cy = height * 0.53;
    const strips = [];
    for (let i = 0; i < 128; i++) {
      const a = (i * Math.PI) / 64,
        b = ((i + 1.08) * Math.PI) / 64;
      const corners = [point(a, -1), point(b, -1), point(b, 1), point(a, 1)];
      strips.push({ corners, depth: corners[0].z, shine: 0.5 + 0.5 * Math.cos(a * 2 + time * 0.39) });
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size, size);
    strips.sort((a, b) => a.depth - b.depth);
    for (const { corners, depth, shine } of strips) {
      const [a, b, c, d] = corners;
      const grad = ctx.createLinearGradient(a.x, a.y, d.x, d.y);
      grad.addColorStop(0, 'rgba(' + accent + ',' + (0.36 + shine * 0.36) + ')');
      grad.addColorStop(0.22, 'rgba(' + accent + ',' + (0.18 + shine * 0.33) + ')');
      grad.addColorStop(0.8, light ? 'rgba(20,80,88,.48)' : 'rgba(27,94,99,.58)');
      grad.addColorStop(1, 'rgba(' + accent + ',' + (0.4 + shine * 0.4) + ')');
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineWidth = 0.85 / size;
      ctx.strokeStyle = 'rgba(' + accent + ',' + (0.38 + 0.21 * depth) + ')';
      ctx.stroke();
    }
    ctx.restore();
  }
  function frame(now) {
    if (
      !width ||
      !height ||
      document.hidden ||
      document.body.matches('.modo-leve,.pausado,.fase-3') ||
      reduced.matches ||
      document.getElementById('susto')
    )
      return;
    if (now - last < 1 / 30) return;
    time += Math.min(0.08, now - last) * (1 + pulse);
    last = now;
    pulse *= 0.95;
    ctx.clearRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(
      width * 0.74,
      height * 0.54,
      1,
      width * 0.74,
      height * 0.54,
      width * 0.32,
    );
    glow.addColorStop(0, 'rgba(' + accent + ',.11)');
    glow.addColorStop(1, 'rgba(' + accent + ',0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    for (const p of dust) {
      let x = ((p.x + time * 0.004) % 1) * width;
      let y = p.y * height + 8 * Math.sin(time * 0.6 + p.phase);
      const dx = x - pointer.x,
        dy = y - pointer.y,
        dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < 95) {
        const shift = (1 - dist / 95) ** 2 * 32;
        x += (shift * dx) / dist;
        y += (shift * dy) / dist;
      }
      ctx.fillStyle = 'rgba(' + accent + ',' + (0.2 + 0.19 * (1 + Math.sin(time + p.phase))) + ')';
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, 2 * Math.PI);
      ctx.fill();
    }
    drawRibbon();
    host.classList.add('on');
  }
  document.addEventListener(
    'pointermove',
    (e) => {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => {
    pointer.x = -1000;
    pointer.y = -1000;
  });
  new ResizeObserver(resize).observe(host);
  resize();
  theme();
  gsap.ticker.add(frame);
  return (name) => {
    if (name === 'tema') theme();
    if (['fase', 'lendo', 'copiado', 'passo', 'fim'].includes(name)) pulse = 0.65;
  };
}
