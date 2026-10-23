/* Pedalada do Delei — movimento (GSAP).
   Tudo aqui é enfeite: se o GSAP não carregar, "Modo Leve" estiver ligado ou o sistema pedir menos movimento,
   o app funciona igual, só sem os efeitos. O app chama window.FXM(nome, ...) nos momentos certos.
   Plugins usados: ScrollTrigger (rolagem), SplitText (letras), ScrambleTextPlugin (números), CustomEase (curva própria). */
(function () {
  'use strict';
  const g = window.gsap, root = document.documentElement;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const leve = () => document.body.classList.contains('modo-leve');
  const anima = () => !!g && !reduz && !leve() && document.visibilityState === 'visible';

  /* ---------- barra de vidro: aparece com a rolagem (vale mesmo sem GSAP) ---------- */
  let hp = 0;
  const lerHp = () => { const v = Math.min(1, scrollY / 140); if (Math.abs(v - hp) > .01) { hp = v; root.style.setProperty('--hp', v.toFixed(3)); } };
  addEventListener('scroll', lerHp, { passive: true }); lerHp();

  if (!g) { window.FXM = () => {}; return; }
  try { g.registerPlugin(...[window.ScrollTrigger, window.SplitText, window.ScrambleTextPlugin, window.CustomEase, window.CustomWiggle].filter(Boolean)); } catch (e) {}
  if (window.CustomEase) { try { window.CustomEase.create('oficina', 'M0,0 C0.12,0.9 0.28,1.04 0.5,1.02 0.7,1 1,1'); } catch (e) {} }
  const ease = window.CustomEase ? 'oficina' : 'power3.out';
  const ST = window.ScrollTrigger, SPLIT = window.SplitText;
  document.body.classList.add('fx-on');

  /* ---------- brilho que acompanha o mouse no fundo ---------- */
  const fundo = $('.fundo');
  if (fundo && !reduz) {
    let px = 50, py = 30, raf = 0, ultimo = 0;
    addEventListener('pointermove', e => {
      px = e.clientX / innerWidth * 100; py = e.clientY / innerHeight * 100;
      if (raf || !anima()) return;
      raf = requestAnimationFrame(t => { raf = 0; if (t - ultimo < 33) return; ultimo = t; fundo.style.setProperty('--mx', px.toFixed(1) + '%'); fundo.style.setProperty('--my', py.toFixed(1) + '%'); });
    }, { passive: true });
  }

  /* ---------- botões "magnéticos": o botão principal se inclina na direção do cursor ---------- */
  if (!reduz && matchMedia('(hover: hover)').matches) {
    let alvo = null;
    const solta = () => { if (alvo) { const b = alvo; g.to(b, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1,.5)', overwrite: 'auto', onComplete: () => g.set(b, { clearProps: 'transform' }) }); alvo = null; } };
    document.addEventListener('pointermove', e => {
      if (!anima()) return;
      const b = e.target.closest && e.target.closest('.btn-pri,.nav.pri');
      if (!b || b.disabled) { solta(); return; }
      if (alvo && alvo !== b) solta();
      alvo = b; const r = b.getBoundingClientRect();
      g.to(b, { x: (e.clientX - (r.left + r.width / 2)) * .12, y: (e.clientY - (r.top + r.height / 2)) * .2, duration: .35, ease: 'power3.out', overwrite: 'auto' });
    }, { passive: true });
    document.addEventListener('pointerleave', solta, true);
  }

  /* ---------- título: as letras sobem uma a uma (e o texto volta ao normal no fim) ---------- */
  function titulo(el, delay) {
    if (!el || !anima() || !SPLIT || !el.textContent.trim()) return;
    try {
      const sp = SPLIT.create(el, { type: 'chars', charsClass: 'fx-ch' });
      g.from(sp.chars, { yPercent: 70, opacity: 0, rotateX: -50, filter: 'blur(8px)', duration: .9, ease, stagger: { each: .022, from: 'start' }, delay: delay || 0,
        onComplete: () => { try { sp.revert(); } catch (e) {} } });
    } catch (e) {}
  }
  /* ---------- números: cada dígito "gira" até o valor certo ---------- */
  function digitos(el, delay) {
    if (!el || !anima() || !SPLIT || !window.ScrambleTextPlugin) return;
    try {
      const sp = SPLIT.create(el, { type: 'chars', charsClass: 'fx-dg' });
      sp.chars.forEach((c, i) => {
        const fim = c.textContent;
        if (/\d/.test(fim)) g.to(c, { duration: .42, delay: (delay || 0) + i * .035, scrambleText: { text: fim, chars: '0123456789', speed: .8 } });
        else g.from(c, { opacity: 0, duration: .25, delay: (delay || 0) + i * .035 });
      });
      g.delayedCall((delay || 0) + sp.chars.length * .035 + .6, () => { try { sp.revert(); } catch (e) {} });
    } catch (e) {}
  }
  /* ---------- faíscas saindo de um elemento (ao copiar um número) ---------- */
  function faiscas(el) {
    if (!anima() || !el) return;
    const r = el.getBoundingClientRect(), n = 16, cx = r.left + Math.min(r.width, 200) / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'); p.className = 'fx-fa'; p.setAttribute('aria-hidden', 'true');
      document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 110;
      g.fromTo(p, { x: cx, y: cy, scale: 1, opacity: 1 }, { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d - 20, scale: 0, opacity: 0, rotation: Math.random() * 180, duration: .7 + Math.random() * .5, ease: 'power3.out', onComplete: () => p.remove() });
    }
  }
  /* ---------- números da lateral: contam até o novo valor ---------- */
  const anteriores = {};
  function contar() {
    $$('.hoje div, .mes-l').forEach(box => {
      const b = box.querySelector('b'), s = box.querySelector('span'); if (!b || !s) return;
      const chave = (box.closest('.hoje') ? 'h:' : 'm:') + s.textContent.trim(), txt = b.textContent.trim();
      if (!/^\d+$/.test(txt)) { delete anteriores[chave]; return; }
      const novo = +txt, ant = anteriores[chave];
      anteriores[chave] = novo;
      if (ant == null || ant === novo || !anima()) return;
      const o = { v: ant };
      g.to(o, { v: novo, duration: .9, ease: 'power2.out', onUpdate: () => { b.textContent = Math.round(o.v); }, onComplete: () => { b.textContent = novo; } });
    });
  }
  /* ---------- leitura da ficha: uma linha de luz varre o campo ---------- */
  function varrer() {
    const m = $('.magic'); if (!m || !anima()) return;
    const l = document.createElement('i'); l.className = 'fx-scan'; l.setAttribute('aria-hidden', 'true'); m.appendChild(l);
    const ta = $('#textoPdf'), top = ta ? ta.offsetTop : 0, h = ta ? ta.offsetHeight : 160;
    g.fromTo(l, { y: top, opacity: 1 }, { y: top + h, opacity: .0, duration: .9, ease: 'power2.inOut', onComplete: () => l.remove() });
  }
  /* ---------- gavetas: os itens entram em fila ---------- */
  function gaveta(p) {
    if (!p || !anima()) return;
    const itens = p.querySelectorAll('.ph, .tools > *, .it, .h-data, .cfg-row, .vazio');
    g.fromTo(itens, { opacity: 0, x: p.classList.contains('p-dir') ? 28 : -28 }, { opacity: 1, x: 0, duration: .6, ease: 'power3.out', stagger: .035, delay: .12, clearProps: 'opacity,transform' });
  }
  /* ---------- rolagem (ScrollTrigger): o número da fase flutua e as seções da lateral entram quando aparecem ---------- */
  function rolagem() {
    if (!ST || reduz) return;
    try {
      const n = $('.numeral');
      if (n) g.to(n, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: '+=900', scrub: .6 } });
      if (matchMedia('(max-width:1180px)').matches) {
        ST.batch('.rail-dir .rbox', { start: 'top 92%', once: true, onEnter: b => g.fromTo(b, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'power3.out', stagger: .1, overwrite: true }) });
      }
    } catch (e) {}
  }

  /* ---------- eventos que o app manda ---------- */
  function evento(nome, ...a) {
    try {
      if (nome === 'fase') {
        if (!anima()) return;
        const n = a[0];
        g.fromTo('.numeral', { opacity: 0, y: 36, scale: 1.05 }, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease });
        g.fromTo('.stepper span', { opacity: .35 }, { opacity: 1, duration: .6, stagger: .08, ease: 'power2.out', clearProps: 'opacity' });
        requestAnimationFrame(() => { titulo(n === 1 ? $('#fase1 .magic-top b') : n === 2 ? $('#lblCodProd') : null, .05); if (ST) ST.refresh(); });
      } else if (nome === 'passo') {
        if (!anima()) return;
        const box = $('#wizCard'); if (!box) return;
        g.from(box.querySelectorAll('.wz-instr, .detalhes, .dec, .lembrete'), { opacity: 0, y: 16, duration: .6, ease: 'power3.out', stagger: .07, delay: .08, clearProps: 'opacity,transform' });
        box.querySelectorAll('.tile .v').forEach((v, i) => digitos(v, .12 + i * .1));
      } else if (nome === 'fim') {
        if (!anima()) return;
        titulo($('.fim h3'), .05);
        g.from('.fim-ico', { scale: .4, opacity: 0, rotate: -40, duration: .9, ease: 'back.out(2)' });
      } else if (nome === 'rails') contar();
      else if (nome === 'copiado') faiscas(a[0]);
      else if (nome === 'lendo') varrer();
      else if (nome === 'painel') gaveta(a[0]);
      else if (nome === 'erro' && window.CustomWiggle && anima() && a[0]) {
        if (!g.parseEase('susto-trem-ui')) window.CustomWiggle.create('susto-trem-ui', { wiggles: 6, type: 'uniform' });
        g.fromTo(a[0], { x: 0 }, { x: 8, duration: .45, ease: 'susto-trem-ui', clearProps: 'transform' });
      }
    } catch (e) {}
  }
  window.FXM = evento;

  /* ---------- abertura do app ---------- */
  function abrir() {
    rolagem();
    if (!anima()) return;
    g.from('.top', { y: -24, opacity: 0, duration: .9, ease: 'power3.out' });
    g.from('.logo svg', { rotate: -200, opacity: 0, duration: 1.4, ease });
    g.from('.numeral', { opacity: 0, y: 40, scale: 1.06, duration: 1.4, ease });
    g.from('.stepper span', { opacity: 0, y: 10, duration: .7, ease: 'power3.out', stagger: .1, delay: .15 });
    titulo($('#fase1 .magic-top b'), .1);
    g.from('.f1-acoes > *', { opacity: 0, y: 14, duration: .7, ease: 'power3.out', stagger: .1, delay: .6, clearProps: 'opacity,transform' });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', abrir); else abrir();
})();
