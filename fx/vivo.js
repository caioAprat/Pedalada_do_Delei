/* Pedalada do Delei — fundo vivo (three.js + GSAP).
   Uma roda de bicicleta feita de linhas finas gira devagar atrás do app, com faíscas de oficina flutuando.
   Ela reage ao uso: avança a cada passo, gira inteira quando o ajuste termina, as faíscas fogem do mouse.
   É só enfeite: carrega depois que o app abriu, pausa quando a janela não está em uso e some no Modo Leve. */
import * as T from '../vendor/three.min.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

const VERT = `
uniform float uTime, uPix, uConv, uEnergia, uBurstT, uEscala;
uniform vec3 uMouse, uCentro, uBurst;
attribute vec4 aSeed;
varying float vA; varying float vQ;
void main(){
  vec3 p = position;
  float vel = 0.05 + aSeed.x * 0.11 + uEnergia * 0.08;
  p.y = mod(p.y + uTime * vel + 8.0, 16.0) - 8.0;
  p.x += sin(uTime * 0.25 + aSeed.y * 6.2831) * 0.4;
  p.z += cos(uTime * 0.2 + aSeed.z * 6.2831) * 0.3;
  // as faíscas fogem do mouse
  vec2 d = p.xy - uMouse.xy;
  float r2 = dot(d, d);
  p.xy += normalize(d + 0.0001) * exp(-r2 * 0.22) * 1.5;
  // ao ler a ficha, são puxadas para o centro da roda em espiral
  vec2 c = p.xy - uCentro.xy;
  float ang = uConv * 2.4 * (0.4 + aSeed.w);
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  p.xy = uCentro.xy + (rot * c) * mix(1.0, 0.28 + aSeed.z * 0.3, uConv * 0.8);
  // estouro (passo concluído, ajuste pronto)
  vec3 db = p - uBurst;
  p += normalize(db + 0.0001) * uBurstT * (1.6 + aSeed.w * 5.0) * exp(-uBurstT * 1.1);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float tam = (1.3 + aSeed.w * 2.6) * (1.0 + uBurstT * exp(-uBurstT) * 1.6);
  gl_PointSize = tam * uPix * uEscala / max(0.5, -mv.z) * 24.0;
  vA = (0.25 + 0.75 * aSeed.x) * (0.55 + 0.45 * sin(uTime * (0.6 + aSeed.y * 1.4) + aSeed.z * 20.0)) * (0.7 + uEnergia * 0.6);
  vQ = aSeed.y;
}`;
const FRAG = `
uniform vec3 uCor, uCorQuente;
uniform float uClaro;
varying float vA; varying float vQ;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = pow(a, 1.4);
  vec3 c = mix(uCor, uCorQuente, vQ * vQ);
  gl_FragColor = vec4(c, a * vA * mix(1.25, 0.85, uClaro));
}`;

export function criar(o) {
  const g = o.gsap, body = document.body, root = document.documentElement;
  const host = document.getElementById('vivo'); if (!host) return null;

  const baixa = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency || 4) <= 2 || innerWidth < 760;
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' }); } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25) * (baixa ? .8 : 1));
  host.appendChild(renderer.domElement);

  const cena = new T.Scene();
  const cam = new T.PerspectiveCamera(45, 1, .1, 60); cam.position.set(0, 0, 12);

  /* ---------- cores (seguem a cor de destaque e o tema) ---------- */
  const cor = new T.Color(), corQ = new T.Color();
  let claro = false;
  const lerCor = () => {
    claro = body.classList.contains('claro');
    const rgb = (getComputedStyle(root).getPropertyValue('--pri-rgb') || '255,154,77').split(',').map(n => (+n || 0) / 255);
    cor.setRGB(rgb[0], rgb[1], rgb[2], T.SRGBColorSpace);
    corQ.setRGB(1, .93, .8, T.SRGBColorSpace);
    if (claro) corQ.copy(cor).multiplyScalar(.7);
    if (matA) { matA.color.copy(cor); matB.color.copy(cor); matC.color.copy(corQ); matA.blending = matB.blending = matC.blending = claro ? T.NormalBlending : T.AdditiveBlending; matA.opacity = claro ? .55 : .5; matB.opacity = claro ? .28 : .22; matC.opacity = claro ? .5 : .55; }
    if (mp) { mp.uniforms.uCor.value.copy(cor); mp.uniforms.uCorQuente.value.copy(corQ); mp.uniforms.uClaro.value = claro ? 1 : 0; mp.blending = claro ? T.NormalBlending : T.AdditiveBlending; }
  };
  let matA, matB, matC, mp;

  /* ---------- a roda ---------- */
  const roda = new T.Group(), disco = new T.Group(); roda.add(disco); cena.add(roda);
  const circulo = (r, n, z = 0) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push(Math.cos(a) * r, Math.sin(a) * r, z); } return new Float32Array(p); };
  const mkLinhas = (arr, mat, loop) => { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); return new (loop ? T.LineLoop : T.LineSegments)(geo, mat); };
  matA = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false, blending: T.AdditiveBlending });
  matB = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .22, depthWrite: false, blending: T.AdditiveBlending });
  matC = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthWrite: false, blending: T.AdditiveBlending });
  const R = 4.2;
  disco.add(mkLinhas(circulo(R, 180), matA, true));                 // aro
  disco.add(mkLinhas(circulo(R * .955, 180), matB, true));          // lado de dentro do aro
  disco.add(mkLinhas(circulo(R * 1.045, 180), matB, true));         // pneu
  disco.add(mkLinhas(circulo(R * .09, 40), matC, true));            // cubo
  disco.add(mkLinhas(circulo(R * .15, 40), matB, true));
  { // raios cruzados, como numa roda de verdade
    const p = [], N = 36;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = a0 + (i % 2 ? .5 : -.5), r0 = R * .12, r1 = R * .955;
      p.push(Math.cos(a0) * r0, Math.sin(a0) * r0, (i % 2 ? .05 : -.05), Math.cos(a1) * r1, Math.sin(a1) * r1, 0);
    }
    disco.add(mkLinhas(new Float32Array(p), matB, false));
  }
  { // marcas ao redor (como um velocímetro)
    const p = [], N = 96;
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, r0 = R * 1.06, r1 = R * (i % 4 === 0 ? 1.14 : 1.095); p.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0); }
    disco.add(mkLinhas(new Float32Array(p), matC, false));
  }

  /* ---------- as faíscas ---------- */
  const N = baixa ? 320 : 620, pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 26; pos[i * 3 + 1] = (Math.random() - .5) * 16; pos[i * 3 + 2] = (Math.random() - .5) * 10; for (let k = 0; k < 4; k++) seed[i * 4 + k] = Math.random(); }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3)); pg.setAttribute('aSeed', new T.BufferAttribute(seed, 4));
  const U = { uTime: { value: 0 }, uPix: { value: renderer.getPixelRatio() }, uConv: { value: 0 }, uEnergia: { value: 0 }, uBurstT: { value: 0 }, uEscala: { value: 1 }, uMouse: { value: new T.Vector3(99, 99, 0) }, uCentro: { value: new T.Vector3() }, uBurst: { value: new T.Vector3() }, uCor: { value: new T.Color() }, uCorQuente: { value: new T.Color() }, uClaro: { value: 0 } };
  mp = new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const faiscas = new T.Points(pg, mp); faiscas.frustumCulled = false; cena.add(faiscas);
  lerCor();

  /* ---------- estado ---------- */
  const S = { rot: 0, vel: .035, conv: 0, energia: 0, escala: 1, x: 0, y: 0, z: 12, rolagem: 0, burstT: 0, mx: 0, my: 0, tx: 0, ty: 0 };
  let W = 1, H = 1, larg = 1, alt = 1, mobile = false, fase = 1;
  const posRoda = () => ({ x: (mobile ? .34 : (fase === 2 ? .33 : .35)) * larg, y: mobile ? .3 * alt : (fase === 3 ? -.04 : .02) * alt, s: mobile ? .62 : (fase === 2 ? 1.02 : fase === 3 ? 1.06 : 1) });
  function tamanho() {
    W = innerWidth; H = innerHeight; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix();
    alt = 2 * Math.tan(cam.fov * Math.PI / 360) * cam.position.z; larg = alt * cam.aspect; mobile = W < 760;
    const p = posRoda(); S.x = p.x; S.y = p.y; S.escala = p.s; U.uPix.value = renderer.getPixelRatio();
  }
  tamanho(); addEventListener('resize', tamanho);
  const doMundo = (cx, cy, v) => v.set((cx / W - .5) * larg, -(cy / H - .5) * alt, 0);

  addEventListener('pointermove', e => { doMundo(e.clientX, e.clientY, U.uMouse.value); S.tx = (e.clientX / W - .5); S.ty = (e.clientY / H - .5); }, { passive: true });
  document.addEventListener('pointerleave', () => U.uMouse.value.set(99, 99, 0));
  addEventListener('scroll', () => { S.rolagem = clamp(scrollY / (innerHeight * .8)); }, { passive: true });

  /* ---------- laço de desenho ---------- */
  let ultimo = 0, parado = false, ocioso = 0;
  const vivo = () => !document.hidden && !body.classList.contains('pausado') && !body.classList.contains('modo-leve') && !document.getElementById('susto');
  function quadro(t, dt) {
    if (!vivo()) return;
    const agora = t, ativo = S.energia > .02 || U.uBurstT.value > .01 || U.uConv.value > .01 || S.rolagem > 0;
    ocioso = ativo ? 0 : ocioso + dt / 1000;
    const limite = ocioso > 4 ? 1000 / 20 : 1000 / 36;
    if (agora * 1000 - ultimo < limite) return; ultimo = agora * 1000;
    const d = Math.min(.1, dt / 1000);
    S.rot += S.vel * d * (1 + S.energia * 2);
    S.mx += (S.tx - S.mx) * .04; S.my += (S.ty - S.my) * .04;
    disco.rotation.z = S.rot;
    roda.position.set(S.x - S.mx * .6, S.y + S.my * .4 + S.rolagem * 1.2, -S.rolagem * 3);
    roda.rotation.set(-.38 + S.my * .18 - S.rolagem * .5, -.5 + S.mx * .25, 0);
    roda.scale.setScalar(S.escala * (1 - S.rolagem * .25));
    const op = 1 - S.rolagem * .75; matA.opacity = (claro ? .55 : .5) * op; matB.opacity = (claro ? .28 : .22) * op; matC.opacity = (claro ? .5 : .55) * op;
    U.uTime.value = agora; U.uCentro.value.set(roda.position.x, roda.position.y, 0);
    S.energia *= Math.pow(.2, d); U.uEnergia.value = S.energia;
    renderer.render(cena, cam);
    if (!host.classList.contains('on')) host.classList.add('on');
  }
  if (g && g.ticker) g.ticker.add(quadro); else { const f = t => { quadro(t / 1000, 16); requestAnimationFrame(f); }; requestAnimationFrame(f); }

  /* ---------- reações ao uso do app ---------- */
  const estouro = (x, y, forca = 1) => {
    doMundo(x, y, U.uBurst.value);
    g.fromTo(U.uBurstT, { value: 0 }, { value: 4 * forca, duration: 2.2, ease: 'power2.out', overwrite: true });
  };
  const girar = (graus, dur, ease) => g.to(S, { rot: S.rot - graus * Math.PI / 180, duration: dur, ease: ease || 'power3.inOut', overwrite: 'auto' });
  function reposicionar() {
    const p = posRoda();
    g.to(S, { x: p.x, y: p.y, escala: p.s, duration: 1.6, ease: 'power3.inOut', overwrite: 'auto' });
  }
  function evento(nome, ...a) {
    try {
      if (nome === 'fase') { fase = a[0]; reposicionar(); g.to(S, { vel: fase === 3 ? .08 : fase === 2 ? .05 : .035, duration: 1.2 }); S.energia = Math.min(1, S.energia + .6); girar(36, 1.4); }
      else if (nome === 'passo') { const n = Math.max(1, a[1] || 1); girar(360 / n, 1.3); estouro(innerWidth * .62, innerHeight * .45, .7); }
      else if (nome === 'fim') { if (a[0]) { girar(720, 3, 'power4.out'); estouro(innerWidth * .6, innerHeight * .5, 1.2); } }
      else if (nome === 'copiado') { const r = a[0] && a[0].getBoundingClientRect && a[0].getBoundingClientRect(); if (r) estouro(r.left + Math.min(r.width, 200) / 2, r.top + r.height / 2, .5); }
      else if (nome === 'lendo') { g.timeline().to(U.uConv, { value: 1, duration: .7, ease: 'power2.in' }).to(U.uConv, { value: 0, duration: 1.4, ease: 'power3.out' }, '+=.15'); S.energia = 1; }
      else if (nome === 'digitar') { S.energia = Math.min(1, S.energia + .35); }
      else if (nome === 'tema') lerCor();
    } catch (e) {}
  }
  const fn = (nome, ...a) => evento(nome, ...a);
  fn.destruir = () => { if (g && g.ticker) g.ticker.remove(quadro); removeEventListener('resize', tamanho); renderer.dispose(); pg.dispose(); mp.dispose(); renderer.domElement.remove(); };
  return fn;
}
