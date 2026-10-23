/* Surpresa escondida (botão do rodapé): corredor 3D + a menina + som.
   Só é carregado quando a usuária passa o mouse/clica no botão. O resto do app não depende deste arquivo.
   Usa three.js (vendor/three.min.js) para a cena e GSAP (vendor/gsap.min.js, já carregado pelo index.html) para a linha do tempo. */
import * as T from '../vendor/three.min.js';

/* Momentos da cena, em segundos desde o clique */
const TM = { pisca: [1.2, 2.5, 3.8, 4.9], preto: 5.15, luz: 6.05, susto: 7.2, corte: 8.9 };
const SONS = ['ambiente', 'sussurro', 'rangido', 'batida', 'grito'];

/* ============================================================
   SONS REAIS (opcionais): susto/sons/<nome>.mp3
   Se o arquivo existir, ele toma o lugar do som sintetizado daquele momento.
   ============================================================ */
let sonsProntos = null;
export function precarregar(){
  if (sonsProntos) return sonsProntos;
  sonsProntos = (async () => {
    const out = {};
    let dec = null;
    try { dec = new OfflineAudioContext(2, 1, 44100); } catch (e) { return out; }
    await Promise.all(SONS.map(async n => {
      try {
        const r = await fetch(new URL('./sons/' + n + '.mp3', import.meta.url), { cache: 'force-cache' });
        const tipo = r.headers.get('content-type') || '';
        if (!r.ok || /text\/html/i.test(tipo)) return;
        out[n] = await dec.decodeAudioData(await r.arrayBuffer());
      } catch (e) { /* arquivo ausente ou ilegível: usa o som sintetizado */ }
    }));
    return out;
  })();
  return sonsProntos;
}

/* ============================================================
   ÁUDIO SINTETIZADO (usado quando não há arquivo em susto/sons/)
   ============================================================ */
export function montarAudio(A, o){
  const t0 = A.currentTime + .03, vol = o.vol, sons = o.sons || {}, calmo = !!o.calmo;
  const sr = A.sampleRate;
  // Ruídos prontos: branco e "marrom" (grave, para rumores)
  const nb = sr * 4 | 0, branco = A.createBuffer(1, nb, sr), marrom = A.createBuffer(1, nb, sr);
  { const d = branco.getChannelData(0), m = marrom.getChannelData(0); let l = 0;
    for (let i = 0; i < nb; i++) { const w = Math.random() * 2 - 1; d[i] = w; l = (l + .02 * w) / 1.02; m[i] = l * 3.5; } }
  const ruido = (buf, s, dur, saida) => { const f = A.createBufferSource(); f.buffer = buf; f.loop = true; f.connect(saida); f.start(s, Math.random() * 2); f.stop(s + dur + .05); return f; };

  // Limitador + saturação suave: nada passa de estourar o alto-falante
  const lim = A.createGain();   // (o compressor do navegador amplifica sons baixos; aqui só a saturação suave segura o pico)
  const macio = A.createWaveShaper(), cv = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) cv[i] = Math.tanh((i / 1024 - 1) * 1.6) * .95;
  macio.curve = cv;
  const master = A.createGain(); master.gain.value = .95 * vol;
  lim.connect(macio).connect(master).connect(A.destination);
  // "bus" é o som da cena (some no apagão); "cru" não é afetado (respiração no escuro)
  const bus = A.createGain(), cru = A.createGain(); cru.connect(lim);
  const sala = A.createConvolver(), nIr = sr * 2.6 | 0, ir = A.createBuffer(2, nIr, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < nIr; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nIr, 2.6); }
  sala.buffer = ir;
  const salaG = A.createGain(); salaG.gain.value = .35;
  bus.connect(lim); bus.connect(sala); sala.connect(salaG).connect(lim);

  const at = t => t0 + t;
  const env = (g, pts, ini = .0001) => { g.gain.setValueAtTime(ini, at(pts[0][0])); pts.forEach(([t, v], i) => { if (i) g.gain.exponentialRampToValueAtTime(Math.max(v, .0001), at(t)); }); };
  const osc = (tipo, f, s, e, saida, g) => { const x = A.createOscillator(); x.type = tipo; x.frequency.value = f; const gg = A.createGain(); gg.gain.value = g; x.connect(gg).connect(saida); x.start(at(s)); x.stop(at(e) + .05); return { x, gg }; };
  const tocar = (nome, s, g, saida, laco, fim) => {
    const b = sons[nome]; if (!b) return false;
    const f = A.createBufferSource(), gg = A.createGain(); f.buffer = b; f.loop = !!laco; gg.gain.value = g;
    f.connect(gg).connect(saida || bus); f.start(at(s)); if (fim) f.stop(at(fim)); return true;
  };
  const pan = (p, saida) => { if (!A.createStereoPanner) return saida; const n = A.createStereoPanner(); n.pan.value = p; n.connect(saida); return n; };

  // Automação do bus: apagão em silêncio, volta devagar, "corte" um instante antes do susto
  const bg = bus.gain;
  bg.setValueAtTime(1, at(0));
  bg.setValueAtTime(1, at(TM.preto - .05)); bg.linearRampToValueAtTime(.02, at(TM.preto));
  bg.setValueAtTime(.02, at(TM.luz - .02)); bg.linearRampToValueAtTime(.75, at(TM.luz + .3));
  bg.setValueAtTime(.75, at(TM.susto - .13)); bg.linearRampToValueAtTime(.04, at(TM.susto - .1));
  bg.setValueAtTime(1, at(TM.susto));
  bg.setValueAtTime(1, at(TM.corte - .01)); bg.linearRampToValueAtTime(0, at(TM.corte + .02));

  /* 1) Fundo: zumbido grave desafinado + rumor que sobe + zumbido agudo */
  const dron = A.createGain(); dron.connect(bus);
  dron.gain.setValueAtTime(.12, at(0)); dron.gain.linearRampToValueAtTime(.5, at(TM.preto - .1)); dron.gain.setValueAtTime(.25, at(TM.luz)); dron.gain.linearRampToValueAtTime(.85, at(TM.susto - .15));
  if (!tocar('ambiente', 0, .5, bus, true, TM.corte)) {
    const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(90, at(0)); lp.frequency.linearRampToValueAtTime(380, at(TM.preto)); lp.frequency.setValueAtTime(140, at(TM.luz)); lp.frequency.linearRampToValueAtTime(900, at(TM.susto - .1)); lp.connect(dron);
    osc('sawtooth', 49, 0, TM.corte, lp, .12); osc('sawtooth', 49.7, 0, TM.corte, lp, .12);
    osc('sine', 32.7, 0, TM.corte, dron, .25);
    // aglomerado dissonante (segunda menor) que cresce devagar
    [[110, .0], [116.5, .0], [164.8, .0]].forEach(([f]) => { const n = osc('triangle', f, 0, TM.preto, dron, .0001); n.gg.gain.setValueAtTime(.0001, at(0)); n.gg.gain.linearRampToValueAtTime(.05, at(TM.preto - .2)); });
    const r = A.createBiquadFilter(), rg = A.createGain(); r.type = 'bandpass'; r.Q.value = 2.2;
    r.frequency.setValueAtTime(260, at(.5)); r.frequency.exponentialRampToValueAtTime(2400, at(TM.preto));
    rg.gain.setValueAtTime(.0001, at(.5)); rg.gain.exponentialRampToValueAtTime(.12, at(TM.preto - .05));
    ruido(marrom, at(.5), TM.preto, r); r.connect(rg).connect(bus);
    // segundo "sobe" depois que a luz volta
    const r2 = A.createBiquadFilter(), r2g = A.createGain(); r2.type = 'bandpass'; r2.Q.value = 3;
    r2.frequency.setValueAtTime(200, at(TM.luz)); r2.frequency.exponentialRampToValueAtTime(3200, at(TM.susto - .1));
    r2g.gain.setValueAtTime(.0001, at(TM.luz)); r2g.gain.exponentialRampToValueAtTime(.16, at(TM.susto - .12));
    ruido(branco, at(TM.luz), TM.susto, r2); r2.connect(r2g).connect(bus);
  }
  { const z = osc('sine', 7600, 1, TM.preto, bus, .0001); z.gg.gain.setValueAtTime(.0001, at(1)); z.gg.gain.linearRampToValueAtTime(.014, at(TM.preto - .3)); }

  /* 2) Caixinha de música desafinada, que vai "esgotando" até o apagão */
  { const notas = [659.3, 784, 987.8, 880, 784, 659.3, 587.3, 659.3]; let t = 1.4, k = 0;
    while (t < TM.preto - .25) {
      const f = notas[k % notas.length] * Math.pow(2, -(k * 14 + 20) / 1200), vv = .03 + k * .003;
      [[1, 1], [2.01, .35], [3.97, .14]].forEach(([m, a]) => { const n = osc('sine', f * m, t, t + 1.1, bus, .0001); n.gg.gain.setValueAtTime(.0001, at(t)); n.gg.gain.exponentialRampToValueAtTime(vv * a, at(t + .01)); n.gg.gain.exponentialRampToValueAtTime(.0001, at(t + 1.0)); });
      t += .62 * Math.pow(1.06, k); k++;
    } }

  /* 3) Coração: acelera até o apagão e volta ainda mais rápido */
  const batida = (t, f) => {
    [0, .19].forEach((d, i) => {
      const s = t + d, x = A.createOscillator(), g = A.createGain();
      x.frequency.setValueAtTime(110, at(s)); x.frequency.exponentialRampToValueAtTime(42, at(s + .13));
      g.gain.setValueAtTime(.0001, at(s)); g.gain.exponentialRampToValueAtTime((i ? .5 : .8) * f, at(s + .012)); g.gain.exponentialRampToValueAtTime(.0001, at(s + .2));
      x.connect(g).connect(bus); x.start(at(s)); x.stop(at(s + .25));
    });
  };
  for (let t = .9, iv = .92, k = 0; t < TM.preto - .15; t += iv, iv = Math.max(.46, iv * .93), k++) batida(t, .2 + Math.min(.4, k * .06));
  for (let t = TM.luz + .15; t < TM.susto - .2; t += .4) batida(t, .7);

  /* 4) Sussurros ("Bruno...") com vogais que deslizam, vindo de lados diferentes */
  const sussurro = (s, p, dur, nome) => {
    if (tocar('sussurro', s, .8, pan(p, bus))) return;
    const saida = pan(p, bus), soma = A.createGain(); soma.connect(saida);
    const voz = A.createOscillator(); voz.type = 'sawtooth'; voz.frequency.setValueAtTime(150, at(s)); voz.frequency.linearRampToValueAtTime(118, at(s + dur));
    const ar = A.createGain(); ar.gain.value = .0001; const sr_ = ruido(branco, at(s), dur, ar);
    const entra = A.createGain(); voz.connect(entra); ar.connect(entra);
    [[550, 330, 8], [1500, 2300, 9], [2800, 3200, 10]].forEach(([a, b, q], i) => {
      const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(a, at(s)); bp.frequency.linearRampToValueAtTime(b, at(s + dur));
      const gg = A.createGain(); gg.gain.value = [1, .6, .5][i] * 1.3; entra.connect(bp).connect(gg).connect(soma);
    });
    ar.gain.value = .9;
    const am = A.createOscillator(), amg = A.createGain(); am.frequency.value = 7; amg.gain.value = .3; am.connect(amg).connect(entra.gain); entra.gain.value = .0001;
    entra.gain.setValueAtTime(.0001, at(s)); entra.gain.linearRampToValueAtTime(.16, at(s + dur * .35)); entra.gain.linearRampToValueAtTime(.0001, at(s + dur));
    voz.start(at(s)); voz.stop(at(s + dur) + .05); am.start(at(s)); am.stop(at(s + dur) + .05);
  };
  sussurro(.45, -.6, 1.1); sussurro(1.75, .65, 1.1); sussurro(3.05, -.3, 1.3);

  /* 5) Porta rangendo (duas vezes) */
  const rangido = (s, dur, f0, p) => {
    if (tocar('rangido', s, .7, pan(p, bus))) return;
    const x = A.createOscillator(), bp = A.createBiquadFilter(), g = A.createGain(), lf = A.createOscillator(), lg = A.createGain();
    x.type = 'sawtooth'; x.frequency.setValueAtTime(f0, at(s)); x.frequency.linearRampToValueAtTime(f0 * 2.1, at(s + dur * .6)); x.frequency.linearRampToValueAtTime(f0 * 1.6, at(s + dur));
    lf.frequency.value = 17; lg.gain.value = f0 * .1; lf.connect(lg).connect(x.frequency);
    bp.type = 'bandpass'; bp.Q.value = 14; bp.frequency.setValueAtTime(700, at(s)); bp.frequency.linearRampToValueAtTime(1500, at(s + dur));
    g.gain.setValueAtTime(.0001, at(s)); g.gain.linearRampToValueAtTime(.09, at(s + dur * .4)); g.gain.linearRampToValueAtTime(.0001, at(s + dur));
    x.connect(bp).connect(g).connect(pan(p, bus)); x.start(at(s)); lf.start(at(s)); x.stop(at(s + dur) + .05); lf.stop(at(s + dur) + .05);
  };
  rangido(2.15, 1.3, 85, .7); rangido(4.1, .9, 100, -.7);

  /* 6) Luz elétrica falhando: "tzzt" ao apagar e "tonk" ao acender */
  TM.pisca.forEach(t => {
    const hp = A.createBiquadFilter(), g = A.createGain(); hp.type = 'bandpass'; hp.frequency.value = 1800; hp.Q.value = 1.4;
    ruido(branco, at(t), .3, hp); hp.connect(g).connect(bus);
    g.gain.setValueAtTime(.0001, at(t)); g.gain.exponentialRampToValueAtTime(.1, at(t + .01)); g.gain.exponentialRampToValueAtTime(.02, at(t + .08)); g.gain.exponentialRampToValueAtTime(.0001, at(t + .2));
    osc('square', 100, t, t + .2, bus, .025);
    const k = osc('sine', 85, t + .2, t + .42, bus, .0001); k.gg.gain.setValueAtTime(.0001, at(t + .2)); k.gg.gain.exponentialRampToValueAtTime(.22, at(t + .205)); k.gg.gain.exponentialRampToValueAtTime(.0001, at(t + .4));
  });
  { const k = osc('sine', 90, TM.luz - .02, TM.luz + .3, bus, .0001); k.gg.gain.setValueAtTime(.0001, at(TM.luz)); k.gg.gain.exponentialRampToValueAtTime(.5, at(TM.luz + .01)); k.gg.gain.exponentialRampToValueAtTime(.0001, at(TM.luz + .28)); }

  /* 7) No escuro: só uma respiração perto do ouvido e um estalo úmido */
  { const bp = A.createBiquadFilter(), g = A.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = .8;
    ruido(marrom, at(TM.preto + .3), .9, bp); bp.connect(g).connect(pan(.2, cru));
    g.gain.setValueAtTime(.0001, at(TM.preto + .3)); g.gain.exponentialRampToValueAtTime(.1, at(TM.preto + .65)); g.gain.exponentialRampToValueAtTime(.0001, at(TM.preto + 1.0));
    const st = A.createBiquadFilter(), sg = A.createGain(); st.type = 'highpass'; st.frequency.value = 3500;
    ruido(branco, at(TM.preto + .62), .04, st); st.connect(sg).connect(pan(-.3, cru));
    sg.gain.setValueAtTime(.0001, at(TM.preto + .62)); sg.gain.exponentialRampToValueAtTime(.03, at(TM.preto + .625)); sg.gain.exponentialRampToValueAtTime(.0001, at(TM.preto + .66)); }

  /* 8) O susto */
  const tB = TM.susto, forte = calmo ? .5 : 1;
  const voz = (s, dur, f0, ganho, p) => {
    const saida = A.createGain(); saida.gain.value = ganho * forte; saida.connect(pan(p, bus));
    const x = A.createOscillator(); x.type = 'sawtooth';
    x.frequency.setValueAtTime(f0 * .7, at(s)); x.frequency.exponentialRampToValueAtTime(f0 * 1.28, at(s + .09)); x.frequency.linearRampToValueAtTime(f0 * 1.1, at(s + dur * .62)); x.frequency.exponentialRampToValueAtTime(f0 * .55, at(s + dur));
    const v1 = A.createOscillator(), g1 = A.createGain(); v1.frequency.value = 5.8; g1.gain.value = f0 * .04; v1.connect(g1).connect(x.frequency);
    const v2 = A.createOscillator(), g2 = A.createGain(); v2.type = 'square'; v2.frequency.value = 33; g2.gain.value = f0 * .018; v2.connect(g2).connect(x.frequency);
    const grave = A.createOscillator(), gg = A.createGain(), tr = A.createOscillator(), trg = A.createGain();
    grave.type = 'sawtooth'; grave.frequency.setValueAtTime(f0 * .5, at(s)); grave.frequency.linearRampToValueAtTime(f0 * .27, at(s + dur)); gg.gain.value = .35;
    tr.frequency.value = 62; trg.gain.value = .3; tr.connect(trg).connect(gg.gain); grave.connect(gg);
    const mix = A.createGain(); x.connect(mix); gg.connect(mix);
    const ar = A.createGain(); ar.gain.value = .3; ruido(branco, at(s), dur, ar); ar.connect(mix);
    const soma = A.createGain();
    [[820, 9, 1], [1300, 10, .8], [2700, 12, .5], [3600, 12, .35]].forEach(([f, q, a]) => { const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const bg2 = A.createGain(); bg2.gain.value = a * 4.2; mix.connect(bp).connect(bg2).connect(soma); });
    const ds = A.createWaveShaper(), c2 = new Float32Array(1024); for (let i = 0; i < 1024; i++) c2[i] = Math.tanh((i / 512 - 1) * 4.5); ds.curve = c2;
    const e = A.createGain(); e.gain.setValueAtTime(.0001, at(s)); e.gain.exponentialRampToValueAtTime(.7, at(s + .035)); e.gain.setValueAtTime(.7, at(s + dur - .45)); e.gain.exponentialRampToValueAtTime(.0001, at(s + dur));
    soma.connect(ds).connect(e).connect(saida);
    [x, v1, v2, grave, tr].forEach(n => { n.start(at(s)); n.stop(at(s + dur) + .05); });
  };
  const impacto = () => {
    if (tocar('batida', tB, 1, bus)) return;
    const x = A.createOscillator(), g = A.createGain();
    x.frequency.setValueAtTime(150, at(tB)); x.frequency.exponentialRampToValueAtTime(28, at(tB + .9));
    g.gain.setValueAtTime(.0001, at(tB)); g.gain.exponentialRampToValueAtTime(1.1, at(tB + .008)); g.gain.exponentialRampToValueAtTime(.0001, at(tB + 1.1));
    x.connect(g).connect(bus); x.start(at(tB)); x.stop(at(tB + 1.2));
    const lp = A.createBiquadFilter(), ng = A.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, at(tB)); lp.frequency.exponentialRampToValueAtTime(200, at(tB + .5));
    ruido(branco, at(tB), .6, lp); lp.connect(ng).connect(bus); ng.gain.setValueAtTime(1, at(tB)); ng.gain.exponentialRampToValueAtTime(.0001, at(tB + .5));
    // violinos estridentes escorregando para cima
    const lpv = A.createBiquadFilter(); lpv.type = 'lowpass'; lpv.frequency.value = 4200; lpv.connect(bus);
    [932, 988, 1047, 1109, 1175, 1245].forEach((f, i) => {
      const n = A.createOscillator(), g2 = A.createGain(), l = A.createOscillator(), lg = A.createGain();
      n.type = 'sawtooth'; n.frequency.setValueAtTime(f, at(tB)); n.frequency.exponentialRampToValueAtTime(f * 1.06, at(tB + 1.7)); l.frequency.value = 6 + i * .4; lg.gain.value = f * .012; l.connect(lg).connect(n.frequency);
      g2.gain.setValueAtTime(.0001, at(tB)); g2.gain.exponentialRampToValueAtTime(.04, at(tB + .03)); g2.gain.exponentialRampToValueAtTime(.0001, at(tB + 1.9));
      n.connect(g2).connect(lpv); n.start(at(tB)); l.start(at(tB)); n.stop(at(tB + 2)); l.stop(at(tB + 2));
    });
  };
  impacto();
  if (!tocar('grito', tB + .02, 1 * forte, bus)) {
    voz(tB + .02, 1.9, 1000, 1, -.15); voz(tB + .5, 1.5, 1190, .7, .35); voz(tB + .95, 1.2, 760, .6, -.45);
    // guincho agudo (FM)
    const c = A.createOscillator(), m = A.createOscillator(), mg = A.createGain(), hp = A.createBiquadFilter(), g = A.createGain();
    c.frequency.setValueAtTime(2600, at(tB)); c.frequency.exponentialRampToValueAtTime(1700, at(tB + .8)); m.frequency.value = 3700; mg.gain.setValueAtTime(2200, at(tB)); mg.gain.linearRampToValueAtTime(400, at(tB + .8));
    m.connect(mg).connect(c.frequency); hp.type = 'highpass'; hp.frequency.value = 1500;
    g.gain.setValueAtTime(.0001, at(tB)); g.gain.exponentialRampToValueAtTime(.09 * forte, at(tB + .02)); g.gain.exponentialRampToValueAtTime(.0001, at(tB + .85));
    c.connect(hp).connect(g).connect(bus); c.start(at(tB)); m.start(at(tB)); c.stop(at(tB + .9)); m.stop(at(tB + .9));
  }

  /* 9) Depois do corte: um tom grave que sobe e um sussurro bem baixo */
  { const x = osc('sine', 55, TM.corte + .3, TM.corte + 5, cru, .0001); x.gg.gain.setValueAtTime(.0001, at(TM.corte + .3)); x.gg.gain.linearRampToValueAtTime(.06, at(TM.corte + 1.6)); x.gg.gain.linearRampToValueAtTime(.0001, at(TM.corte + 5));
    const y = osc('sine', 110.6, TM.corte + .3, TM.corte + 5, cru, .0001); y.gg.gain.setValueAtTime(.0001, at(TM.corte + .3)); y.gg.gain.linearRampToValueAtTime(.02, at(TM.corte + 1.6)); y.gg.gain.linearRampToValueAtTime(.0001, at(TM.corte + 5)); }

  return {
    parar(){
      const t = A.currentTime;
      try { master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + .18); } catch (e) {}
      setTimeout(() => { try { lim.disconnect(); master.disconnect(); } catch (e) {} }, 400);
    }
  };
}

/* ============================================================
   TEXTURAS (desenhadas aqui, sem imagens externas)
   ============================================================ */
const lona = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function texDe(c, rx, ry){ const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 4; return t; }
function semente(n){ let s = n; return () => (s = s * 16807 % 2147483647) / 2147483647; }

function cvParede(){
  const R = semente(11), c = lona(512, 512), g = c.getContext('2d');
  g.fillStyle = '#4b4a3b'; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 32) { g.fillStyle = (x / 32) % 2 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,220,.04)'; g.fillRect(x, 0, 32, 512); }
  g.fillStyle = 'rgba(25,28,14,.2)';
  for (let x = 16; x < 512; x += 64) for (let y = 20; y < 360; y += 60) { g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 9, y); g.lineTo(x, y + 14); g.lineTo(x - 9, y); g.fill(); }
  g.fillStyle = '#2a2923'; g.fillRect(0, 372, 512, 140); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 366, 512, 7); g.fillStyle = 'rgba(255,255,230,.07)'; g.fillRect(0, 372, 512, 2);
  for (let i = 0; i < 26; i++) { const x = R() * 512, w = 4 + R() * 26, h = 90 + R() * 300, gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `rgba(12,8,0,${.25 + R() * .3})`); gr.addColorStop(1, 'rgba(12,8,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, h); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${R() < .3 ? '70,12,10' : '10,10,6'},${.08 + R() * .2})`; g.beginPath(); g.ellipse(R() * 512, R() * 512, 8 + R() * 50, 6 + R() * 30, R() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(200,195,160,.08)'; g.beginPath(); g.moveTo(R() * 512, R() * 300); g.lineTo(R() * 512, R() * 300); g.lineTo(R() * 512, R() * 300); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1;
  for (let i = 0; i < 18; i++) { let x = R() * 512, y = R() * 512; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R() - .5) * 40; y += (R() - .3) * 30; g.lineTo(x, y); } g.stroke(); }
  return c;
}
function cvChao(){
  const R = semente(23), c = lona(512, 512), g = c.getContext('2d');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#2a2f2b' : '#1b1f1c'; g.fillRect(i * 128, j * 128, 128, 128); }
  g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${R() < .25 ? '60,8,8' : '0,0,0'},${.1 + R() * .3})`; g.beginPath(); g.ellipse(R() * 512, R() * 512, 6 + R() * 45, 4 + R() * 26, R() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${R() * .05})`; g.fillRect(R() * 512, R() * 512, 1 + R() * 18, 1); }
  return c;
}
function cvTeto(){
  const R = semente(31), c = lona(256, 256), g = c.getContext('2d');
  g.fillStyle = '#3a3a33'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 256); g.moveTo(0, i * 128); g.lineTo(256, i * 128); g.stroke(); }
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(30,22,5,${.1 + R() * .25})`; g.beginPath(); g.ellipse(R() * 256, R() * 256, 5 + R() * 28, 4 + R() * 18, R() * 3, 0, 7); g.fill(); }
  return c;
}
function cvPele(){
  const R = semente(5), c = lona(512, 512), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#a9aea0'); gr.addColorStop(.55, '#8e968b'); gr.addColorStop(1, '#6f776e');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${R() < .6 ? '40,55,50' : '110,35,35'},${R() * .12})`; g.beginPath(); g.ellipse(R() * 512, R() * 512, 3 + R() * 24, 3 + R() * 16, R() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(50,70,100,.34)'; g.lineWidth = 1.3;
  for (let i = 0; i < 40; i++) { let x = R() * 512, y = 180 + R() * 220; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (R() - .5) * 26; y += 5 + R() * 13; g.lineTo(x, y); } g.stroke(); }
  // olheiras fundas ao redor dos olhos (u=0.1863 e 0.3137, v=0.534 -> y de baixo para cima)
  [[95, 218], [161, 212]].forEach(([x, y]) => { const o = g.createRadialGradient(x, y, 4, x, y, 40); o.addColorStop(0, 'rgba(8,2,6,.95)'); o.addColorStop(.55, 'rgba(25,8,14,.6)'); o.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = o; g.beginPath(); g.ellipse(x, y, 44, 56, 0, 0, 7); g.fill(); });
  // lábios e boca secos (u=.25, v ~ .42)
  const bo = g.createRadialGradient(128, 296, 2, 128, 296, 34); bo.addColorStop(0, 'rgba(60,15,20,.6)'); bo.addColorStop(1, 'rgba(60,15,20,0)'); g.fillStyle = bo; g.beginPath(); g.ellipse(128, 296, 38, 20, 0, 0, 7); g.fill();
  return c;
}
function cvOlho(){
  const R = semente(9), c = lona(256, 256), g = c.getContext('2d');
  const b = g.createRadialGradient(64, 128, 6, 64, 128, 128); b.addColorStop(0, '#f3ead0'); b.addColorStop(.5, '#d9c7a4'); b.addColorStop(1, '#7c2a22');
  g.fillStyle = b; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(190,20,22,.85)'; g.lineWidth = 1.2;
  for (let i = 0; i < 90; i++) { const a = R() * 6.28; let x = 64 + Math.cos(a) * 62, y = 128 + Math.sin(a) * 62; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (64 - x) * .16 + (R() - .5) * 6; y += (128 - y) * .16 + (R() - .5) * 6; g.lineTo(x, y); } g.stroke(); }
  let o = g.createRadialGradient(64, 128, 3, 64, 128, 24); o.addColorStop(0, '#050505'); o.addColorStop(.25, '#0b0b0b'); o.addColorStop(.32, '#7b7e78'); o.addColorStop(.85, '#3d403c'); o.addColorStop(1, '#0c0c0c');
  g.fillStyle = o; g.beginPath(); g.arc(64, 128, 24, 0, 7); g.fill();
  g.fillStyle = '#000'; g.beginPath(); g.arc(64, 128, 5, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(72, 119, 3, 0, 7); g.fill();
  return c;
}
function cvVestido(){
  const R = semente(17), c = lona(256, 256), g = c.getContext('2d');
  g.fillStyle = '#b4b3a8'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { const x = R() * 256, w = 2 + R() * 12, h = 40 + R() * 200, gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `rgba(60,45,25,${.1 + R() * .25})`); gr.addColorStop(1, 'rgba(60,45,25,0)'); g.fillStyle = gr; g.fillRect(x, R() * 80, w, h); }
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${R() < .5 ? '90,14,10' : '40,32,22'},${.15 + R() * .3})`; g.beginPath(); g.ellipse(R() * 256, 90 + R() * 166, 3 + R() * 20, 3 + R() * 26, R() * 3, 0, 7); g.fill(); }
  return c;
}

/* ============================================================
   A MENINA
   ============================================================ */
const HX = .145, HY = .195, HZ = .155;   // elipsoide da cabeça
function criarCabelo(n){
  const SEG = 10, R = semente(77), pos = new Float32Array(n * (SEG + 1) * 2 * 3), A = {
    raiz: new Float32Array(n * (SEG + 1) * 2 * 3), t: new Float32Array(n * (SEG + 1) * 2), lado: new Float32Array(n * (SEG + 1) * 2),
    sem: new Float32Array(n * (SEG + 1) * 2), len: new Float32Array(n * (SEG + 1) * 2)
  };
  const idx = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    // raízes espalhadas no alto e dos lados; a maioria na frente para cobrir o rosto
    const frente = R() < .5, az = frente ? (R() - .5) * 2.9 : (R() * 6.28), th = frente ? .22 + R() * .5 : .25 + Math.pow(R(), .8) * 1.45;
    const rx = HX * Math.sin(th) * Math.sin(az), rz = HZ * Math.sin(th) * Math.cos(az), ry = HY * Math.cos(th);
    const len = (frente ? .5 : .55) + R() * .45, sem = R();
    for (let s = 0; s <= SEG; s++) for (let l = 0; l < 2; l++) {
      A.raiz.set([rx, ry, rz], v * 3); A.t[v] = s / SEG; A.lado[v] = l ? 1 : -1; A.sem[v] = sem; A.len[v] = len; v++;
    }
    const b = v - (SEG + 1) * 2;
    for (let s = 0; s < SEG; s++) { const a = b + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(A.raiz, 3));   // a posição real é calculada no shader
  geo.setAttribute('aT', new T.BufferAttribute(A.t, 1));
  geo.setAttribute('aLado', new T.BufferAttribute(A.lado, 1));
  geo.setAttribute('aSem', new T.BufferAttribute(A.sem, 1));
  geo.setAttribute('aLen', new T.BufferAttribute(A.len, 1));
  geo.setIndex(idx);
  return geo;
}
const VS_CABELO = `
uniform float uTime, uAbrirL, uAbrirR, uFog, uBalanco;
attribute float aT, aLado, aSem, aLen;
varying float vF; varying float vBrilho;
void main(){
  float t = aT;
  vec3 p = position;
  float ax = abs(p.x);
  float lado = p.x >= 0.0 ? 1.0 : -1.0;
  float abrir = lado > 0.0 ? uAbrirR : uAbrirL;
  float empurra = abrir * smoothstep(0.0, 0.3, t) * max(0.0, 0.125 - ax);
  p.x += lado * (empurra + 0.018 * abrir * step(0.0001, empurra));
  p.y -= aLen * t;
  p.xz += normalize(position.xz + vec2(0.0001)) * 0.03 * t * (0.4 + aSem);
  float bal = sin(uTime * 1.25 + aSem * 6.28 + t * 3.2) * 0.014 * t * uBalanco;
  p.x += bal; p.z += bal * 0.6;
  vec3 q = p / vec3(${HX.toFixed(3)}, ${HY.toFixed(3)}, ${HZ.toFixed(3)});
  float e = dot(q, q);
  if (e < 1.1) p *= 1.05 / sqrt(max(e, 0.05));
  p.x += aLado * 0.0048;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = length(mv.xyz);
  vF = exp(-pow(uFog * d, 2.0));
  vBrilho = pow(max(0.0, sin(t * 8.0 + aSem * 19.0)), 10.0) * (1.0 - t * 0.5);
}`;
const FS_CABELO = `
varying float vF; varying float vBrilho;
void main(){
  vec3 c = vec3(0.012, 0.011, 0.015) + vec3(0.06, 0.06, 0.09) * vBrilho;
  gl_FragColor = vec4(c * vF, 1.0);
}`;

function criarMenina(leve){
  const raiz = new T.Group(), pele = texDe(cvPele(), 1, 1);
  const matPele = new T.MeshStandardMaterial({ map: pele, roughness: .8, metalness: 0, emissive: new T.Color(0x2a2e2a), emissiveMap: pele, emissiveIntensity: .55 });
  const matMembro = new T.MeshStandardMaterial({ color: 0x8b9288, roughness: .85, emissive: new T.Color(0x151a16) });

  // Vestido (revolução com a barra rasgada)
  const perfil = [[.33, 0], [.3, .15], [.24, .42], [.16, .7], [.115, .93], [.105, 1.03], [.125, 1.08], [.05, 1.12]].map(([r, y]) => new T.Vector2(r, y));
  const vest = new T.LatheGeometry(perfil, 36);
  { const p = vest.attributes.position, R = semente(3);
    for (let i = 0; i < p.count; i++) { if (p.getY(i) < .02) p.setY(i, (R() < .5 ? R() * .16 : R() * .04)); const a = Math.atan2(p.getZ(i), p.getX(i)); const f = 1 + Math.sin(a * 5 + p.getY(i) * 4) * .03; p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
    vest.computeVertexNormals(); }
  const vestido = new T.Mesh(vest, new T.MeshStandardMaterial({ map: texDe(cvVestido(), 3, 1), roughness: .95, side: T.DoubleSide, emissive: new T.Color(0x38382f) }));
  raiz.add(vestido);

  // Pescoço e cabeça
  const pescoco = new T.Mesh(new T.CylinderGeometry(.03, .036, .13, 10), matMembro); pescoco.position.y = 1.13; raiz.add(pescoco);
  const cabeca = new T.Group(); cabeca.position.y = 1.17; raiz.add(cabeca);
  const rosto = new T.Group(); rosto.position.y = HY; cabeca.add(rosto);          // rosto estica quando ela grita
  const cranio = new T.Mesh(new T.SphereGeometry(1, 36, 28), matPele); cranio.scale.set(HX - .006, HY - .006, HZ - .006); rosto.add(cranio);
  const nariz = new T.Mesh(new T.SphereGeometry(1, 10, 8), matPele); nariz.scale.set(.016, .03, .02); nariz.position.set(0, -.025, .15); rosto.add(nariz);
  const texOlho = texDe(cvOlho()); texOlho.wrapS = texOlho.wrapT = T.ClampToEdgeWrapping;
  const matOlho = new T.MeshStandardMaterial({ map: texOlho, roughness: .3, emissive: new T.Color(0xffffff), emissiveMap: texOlho, emissiveIntensity: .32 });
  const matSombra = new T.MeshBasicMaterial({ color: 0x080204 });
  const olhos = [];
  [[-.058, .03, .118, .035], [.062, .036, .12, .039]].forEach(([x, y, z, r]) => {
    const orbita = new T.Mesh(new T.SphereGeometry(1, 16, 12), matSombra); orbita.scale.set(r * 1.55, r * 1.45, r * .9); orbita.position.set(x, y, z - .006); rosto.add(orbita);
    const o = new T.Mesh(new T.SphereGeometry(r, 20, 16), matOlho); o.position.set(x, y, z + .004); rosto.add(o); olhos.push(o);
  });
  // Boca
  const boca = new T.Group(); boca.position.set(0, -.075, .136); rosto.add(boca);
  const buraco = new T.Mesh(new T.SphereGeometry(1, 20, 14), new T.MeshBasicMaterial({ color: 0x050001 })); boca.add(buraco);
  const labio = new T.Mesh(new T.TorusGeometry(1, .14, 6, 28), new T.MeshStandardMaterial({ color: 0x3c1116, roughness: .8 })); labio.position.z = .002; boca.add(labio);
  const dentes = new T.MeshStandardMaterial({ color: 0xcbc29b, roughness: .5, emissive: new T.Color(0x2a2616) });
  const dentesTopo = [];
  for (let i = 0; i < 7; i++) { const d = new T.Mesh(new T.BoxGeometry(.0042, .011, .004), dentes); const a = (i / 6 - .5) * 1.7; d.position.set(Math.sin(a) * .8, Math.cos(a) * .55 - .02, .004); boca.add(d); dentesTopo.push(d); }

  // Cabelo (fitas desenhadas no shader: balançam e se abrem)
  const cabeloMat = new T.ShaderMaterial({
    vertexShader: VS_CABELO, fragmentShader: FS_CABELO, side: T.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAbrirL: { value: 0 }, uAbrirR: { value: 0 }, uFog: { value: .06 }, uBalanco: { value: 1 } }
  });
  const cabelo = new T.Mesh(criarCabelo(leve ? 460 : 960), cabeloMat); cabelo.frustumCulled = false; cabeca.add(cabelo);
  cabelo.position.y = HY;

  // Braços longos, dedos finos
  const braco = lado => {
    const ombro = new T.Group(); ombro.position.set(lado * .115, 1.02, 0); raiz.add(ombro);
    const sup = new T.Mesh(new T.CylinderGeometry(.021, .018, .3, 8), matMembro); sup.position.y = -.15; ombro.add(sup);
    const cotovelo = new T.Group(); cotovelo.position.y = -.3; ombro.add(cotovelo);
    const ant = new T.Mesh(new T.CylinderGeometry(.017, .013, .3, 8), matMembro); ant.position.y = -.15; cotovelo.add(ant);
    const mao = new T.Group(); mao.position.y = -.31; cotovelo.add(mao);
    const palma = new T.Mesh(new T.BoxGeometry(.05, .06, .014), matMembro); palma.position.y = -.025; mao.add(palma);
    const dedos = [];
    for (let i = 0; i < 5; i++) {
      const d = new T.Group(); d.position.set((i - 2) * .0105, -.055, 0); mao.add(d);
      const m = new T.Mesh(new T.CylinderGeometry(.0045, .0035, i === 0 ? .06 : .105, 5), matMembro); m.position.y = -(i === 0 ? .03 : .052); d.add(m);
      d.rotation.z = (i - 2) * .06; dedos.push(d);
    }
    return { ombro, cotovelo, mao, dedos };
  };
  const bE = braco(-1), bD = braco(1);
  bE.ombro.rotation.z = -.07; bD.ombro.rotation.z = .07;

  return { raiz, cabeca, rosto, boca, buraco, labio, dentesTopo, olhos, cabelo: cabeloMat, bE, bD, vestido };
}

/* ============================================================
   PÓS-PROCESSAMENTO: grão, aberração, falha, vinheta, vermelho
   ============================================================ */
const FS_POS = `
uniform sampler2D tDiffuse;
uniform float uTime, uGlitch, uAber, uRed, uFade, uFlash, uVig, uGrain, uExpo, uRedVig;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  float passo = floor(uTime * 16.0);
  float faixa = step(0.62, h(vec2(floor(uv.y * 24.0), passo)));
  uv.x += uGlitch * faixa * (h(vec2(passo, floor(uv.y * 24.0))) - 0.5) * 0.045;
  uv.y += uGlitch * step(0.97, h(vec2(passo, 3.0))) * 0.03;
  vec2 d = uv - 0.5;
  float ab = uAber * (0.0015 + 0.02 * dot(d, d));
  vec3 c;
  c.r = texture2D(tDiffuse, uv + d * ab * 2.0).r;
  c.g = texture2D(tDiffuse, uv).g;
  c.b = texture2D(tDiffuse, uv - d * ab * 2.0).b;
  c *= uExpo;
  c = c / (1.0 + c * 0.6);
  c = pow(c, vec3(1.0 / 2.2));
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(lum) * vec3(1.18, 0.26, 0.22), uRed);
  c = pow(c, vec3(1.0 + uRed * 0.45));
  float r = length(d);
  float v = smoothstep(0.95, 0.18, r * uVig);
  c *= mix(0.12, 1.0, v);
  c += vec3(0.34, 0.0, 0.015) * (1.0 - v) * uRedVig;
  float gr = (h(uv * 900.0 + passo) - 0.5) * uGrain;
  c += gr;
  c *= 0.93 + 0.07 * sin(uv.y * 900.0);
  c = mix(c, vec3(0.78, 0.015, 0.04), uFlash);
  c *= 1.0 - uFade;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`;

/* ============================================================
   CENA + LINHA DO TEMPO
   ============================================================ */
export function rodar(el, o){
  const g = o.gsap, leve = !!o.leve, calmo = !!o.calmo;
  const S = { luz: 0, fade: 1, glitch: 0, aber: .4, red: 0, vig: 1, redVig: .15, flash: 0, expo: 1.15, tremor: 0, twitch: 0, camL: 0, sangue: 0, camY: 0, boca: 0, partE: 0, partD: 0, olharY: 1.2, grain: .09, balanco: 1 };
  const aud = o.actx && o.config.sons ? { A: o.actx } : null;

  // --- WebGL (se falhar, quem chamou usa a versão simples) ---
  const cv = document.createElement('canvas'); cv.className = 'susto-3d';
  cv.setAttribute('aria-hidden', 'true');
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const escala = leve ? .5 : .75;
  let W = Math.max(320, Math.round(innerWidth * escala)), H = Math.max(240, Math.round(innerHeight * escala));
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 1);
  el.insertBefore(cv, el.firstChild);

  const cena = new T.Scene();
  const nevoa = new T.FogExp2(0x040203, .075); cena.fog = nevoa;
  const cam = new T.PerspectiveCamera(62, W / H, .04, 60);
  cam.position.set(0, 1.15, 1.2);
  const rt = new T.WebGLRenderTarget(W, H, { depthBuffer: true, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
  const posCena = new T.Scene(), posCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const U = { tDiffuse: { value: rt.texture }, uTime: { value: 0 }, uGlitch: { value: 0 }, uAber: { value: 0 }, uRed: { value: 0 }, uFade: { value: 1 }, uFlash: { value: 0 }, uVig: { value: 1 }, uGrain: { value: .1 }, uExpo: { value: 1 }, uRedVig: { value: 0 } };
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FS_POS
  }));
  posCena.add(quad);

  // --- Corredor ---
  const CL = 40, CW = 3.2, CH = 2.8;
  const tParede = texDe(cvParede(), 14, 1), tParede2 = texDe(cvParede(), 14, 1), tFim = texDe(cvParede(), 1, 1);
  const tChao = texDe(cvChao(), 2, 25), tTeto = texDe(cvTeto(), 3, 30);
  const mat = (map, cor) => new T.MeshStandardMaterial({ map, color: cor || 0xffffff, roughness: .92, side: T.BackSide });
  const corredor = new T.Mesh(new T.BoxGeometry(CW, CH, CL), [mat(tParede), mat(tParede2), mat(tTeto), new T.MeshStandardMaterial({ map: tChao, roughness: .45, metalness: .1, side: T.BackSide }), mat(tFim), mat(tFim)]);
  corredor.position.set(0, CH / 2, 2 - CL / 2); cena.add(corredor);
  const matPorta = new T.MeshStandardMaterial({ color: 0x1d1612, roughness: .8 }), matFresta = new T.MeshBasicMaterial({ color: 0x000000 });
  [[-1, -5.5], [1, -8.5], [-1, -12.5], [1, -16], [-1, -20.5], [1, -25]].forEach(([lado, z], i) => {
    const grp = new T.Group(); grp.position.set(lado * (CW / 2 - .02), 1.05, z); grp.rotation.y = -lado * Math.PI / 2;
    const moldura = new T.Mesh(new T.PlaneGeometry(1.1, 2.18), new T.MeshStandardMaterial({ color: 0x0c0907, roughness: 1 })); grp.add(moldura);
    const porta = new T.Mesh(new T.PlaneGeometry(.95, 2.08), matPorta); porta.position.z = .004; grp.add(porta);
    if (i === 2 || i === 4) { const f = new T.Mesh(new T.PlaneGeometry(.07, 2.08), matFresta); f.position.set(.36, 0, .008); grp.add(f); }
    cena.add(grp);
  });

  // luzes: tubos no teto + uma luz de emergência vermelha lá no fundo + lanterna na câmera
  const frio = new T.Color(0xcfe8d4), verm = new T.Color(0xff1020), tmp = new T.Color();
  const lampadas = [[-3, 42], [-10, 42], [-17, 46]].map(([z, I]) => {
    const l = new T.PointLight(0xcfe8d4, I, 0, 2); l.position.set(0, 2.45, z); cena.add(l);
    const tubo = new T.Mesh(new T.BoxGeometry(.22, .035, 1.3), new T.MeshBasicMaterial({ color: 0x000000 })); tubo.position.set(0, CH - .03, z); cena.add(tubo);
    return { l, tubo, I };
  });
  const emerg = new T.PointLight(0xff1020, 0, 0, 2); emerg.position.set(0, 2.2, -26); cena.add(emerg);
  const lanterna = new T.PointLight(0xbfd2ff, 0, 0, 2); cena.add(lanterna);
  cena.add(new T.AmbientLight(0x2a1a22, .9));

  // --- A menina ---
  const M = criarMenina(leve);
  M.raiz.position.set(0, 0, -18); cena.add(M.raiz);
  M.cabeca.rotation.set(.1, 0, .06);

  // --- Texto na tela ---
  const msg = el.querySelector('.susto-msg'), fim = el.querySelector('.susto-fim'), fimB = fim.querySelector('b'), fimS = fim.querySelector('small');
  msg.textContent = '';
  const letras = txt => [...txt].map(c => { const s = document.createElement('span'); s.textContent = c; s.setAttribute('aria-hidden', 'true'); return s; });

  const tl = g.timeline({ paused: true });
  const fala = (txt, t, dur, cls) => {
    const d = document.createElement('div'); d.className = 'fala ' + (cls || ''); d.setAttribute('role', 'img'); d.setAttribute('aria-label', txt);
    const sp = letras(txt); sp.forEach(s => d.appendChild(s)); msg.appendChild(d);
    const grito = cls === 'grito';
    tl.fromTo(sp, { opacity: 0, filter: 'blur(14px)', y: 16, scale: 1.8, color: '#ff2638' },
      { opacity: 1, filter: 'blur(0px)', y: 0, scale: 1, color: grito ? '#ff3a48' : '#ece0dc', duration: grito ? .3 : .6, ease: 'power3.out', stagger: grito ? .035 : .06 }, t);
    if (grito && !calmo) tl.to(sp, { x: 'random(-3,3)', y: 'random(-2,2)', duration: .05, repeat: 9, ease: 'none' }, t + .35);
    tl.to(sp, { opacity: 0, filter: 'blur(12px)', y: -10, duration: .42, ease: 'power2.in', stagger: { each: .02, from: 'random' } }, t + dur);
  };
  fala('Bruno...', .45, 1.0);
  fala('você ouviu isso?', 1.75, 1.0);
  fala('ela já sabe o seu nome', 3.0, 1.05);
  fala('NÃO PISQUE', 4.35, .62, 'grito');

  // --- Luz: cada queda é um único apaga-acende (no máximo 1 por segundo) ---
  tl.to(S, { fade: 0, duration: 1.4, ease: 'power2.out' }, 0);
  tl.set(S, { luz: .0 }, 0).to(S, { luz: 1, duration: .5, ease: 'steps(3)' }, .25);
  const zs = [-14, -10.8, -7.4, -4.6];
  TM.pisca.forEach((t, i) => {
    tl.set(S, { luz: 0 }, t).set(M.raiz.position, { z: zs[i] }, t + .05).set(S, { luz: .45 }, t + .17).set(S, { luz: 1 }, t + .22);
  });
  tl.set(M.raiz.position, { z: -18 }, 0);
  // a câmera vai se aproximando sem que ela perceba
  tl.fromTo(cam.position, { z: 1.2 }, { z: .15, duration: TM.preto, ease: 'none' }, 0);
  tl.to(S, { camL: .45, tremor: .12, duration: TM.preto, ease: 'power1.in' }, 0);
  tl.to(S, { aber: 1.2, redVig: .45, duration: TM.preto, ease: 'power1.in' }, 0);
  tl.to(S, { twitch: .5, duration: 2, ease: 'none' }, 3.2);

  // --- Apagão total: silêncio, ela se aproxima sem ser vista ---
  tl.set(S, { luz: 0, camL: 0 }, TM.preto);
  tl.set(M.raiz.position, { z: -2.35 }, TM.preto + .2);
  tl.set(M.cabeca.rotation, { x: .62, z: .32 }, TM.preto + .2);
  tl.set(S, { twitch: 0, tremor: 0 }, TM.preto);
  // --- A luz volta: ela está bem perto, de cabeça baixa ---
  tl.set(S, { luz: 1 }, TM.luz).set(S, { luz: .3 }, TM.luz + .08).set(S, { luz: 1 }, TM.luz + .13);
  tl.to(S, { camL: .8, duration: 1.1, ease: 'power1.in' }, TM.luz);
  tl.to(M.cabeca.rotation, { x: -.02, z: .1, duration: .95, ease: 'power2.inOut' }, TM.luz + .2);
  tl.to(S, { partD: .55, duration: .9, ease: 'power2.inOut' }, TM.luz + .25);
  tl.to(S, { twitch: 1, tremor: .25, duration: .9, ease: 'none' }, TM.luz + .2);
  tl.to(cam.position, { z: .02, duration: TM.susto - TM.luz, ease: 'none' }, TM.luz);
  tl.to(S, { olharY: 1.3, camY: .1, duration: 1, ease: 'power1.inOut' }, TM.luz);

  // --- O susto ---
  const B = TM.susto;
  tl.set(S, { twitch: 0 }, B);
  if (!calmo) {
    tl.set(S, { flash: 1 }, B).to(S, { flash: 0, duration: .55, ease: 'power2.out' }, B + .05);   // um único clarão
    tl.set(M.raiz.position, { z: -1.25 }, B);
    tl.to(M.raiz.position, { z: -.78, duration: .12, ease: 'expo.out' }, B + .01);
    tl.to(cam, { fov: 80, duration: .1, ease: 'power4.out', onUpdate: () => cam.updateProjectionMatrix() }, B);
    tl.to(cam, { fov: 68, duration: 1.4, ease: 'power2.out', onUpdate: () => cam.updateProjectionMatrix() }, B + .1);
    tl.set(S, { tremor: 1.6, glitch: .6, aber: 3.2 }, B);
    tl.to(S, { tremor: .35, duration: 1.4, ease: 'power3.out' }, B + .06);
    tl.to(S, { glitch: .25, duration: .5, ease: 'power2.out' }, B + .1);
    tl.set(S, { glitch: .5 }, B + .62).to(S, { glitch: .2, duration: .3 }, B + .65);
    tl.to(S, { aber: 1.6, duration: 1, ease: 'power2.out' }, B + .1);
  } else {
    tl.set(M.raiz.position, { z: -.9 }, B);
    tl.to(S, { tremor: .1, duration: .3 }, B);
  }
  tl.to(S, { red: .62, redVig: .85, sangue: 1, camL: .3, vig: 1.15, olharY: 1.36, camY: .2, duration: .1 }, B);
  tl.to(S, { red: .4, duration: 1.6, ease: 'power1.out' }, B + .3);
  tl.to(S, { boca: 1, partE: 1, partD: 1, duration: .09, ease: 'power3.out' }, B);
  tl.to(M.cabeca.rotation, { x: -.3, z: .0, duration: .12, ease: 'power3.out' }, B);
  [M.bE, M.bD].forEach((b, i) => {
    tl.to(b.ombro.rotation, { x: -1.25, z: i ? .6 : -.6, duration: .22, ease: 'power3.out' }, B + .02);
    tl.to(b.cotovelo.rotation, { x: -.25, duration: .22, ease: 'power2.out' }, B + .02);
    b.dedos.forEach((d, k) => tl.to(d.rotation, { z: (k - 2) * .3, duration: .2 }, B + .04));
  });
  // ela continua se aproximando, tremendo, até quase encostar na câmera
  tl.to(M.raiz.position, { z: -.5, duration: TM.corte - B - .15, ease: 'power1.in' }, B + .15);
  tl.to(S, { twitch: 1.5, duration: .5 }, B + .5);
  tl.to(S, { aber: 3, glitch: .6, duration: TM.corte - B - 1.0, ease: 'power2.in' }, B + 1.0);
  // corte seco para o escuro
  tl.set(S, { fade: 1, glitch: 1 }, TM.corte);
  tl.set(S, { flash: 0 }, TM.corte);
  tl.call(() => el.classList.add('fim'), null, TM.corte + .3);
  tl.to(S, { fade: .62, glitch: .1, tremor: .4, red: .65, duration: 1.3, ease: 'power2.out' }, TM.corte + .35);
  const sp = letras(fimB.textContent); fimB.textContent = ''; sp.forEach(s => fimB.appendChild(s));
  tl.fromTo(sp, { opacity: 0, filter: 'blur(18px)', y: 34, scale: 2.4, rotation: 'random(-9,9)' },
    { opacity: 1, filter: 'blur(0px)', y: 0, scale: 1, rotation: 0, duration: .75, ease: 'expo.out', stagger: .06 }, TM.corte + .45);
  tl.fromTo(fimS, { opacity: 0 }, { opacity: 1, duration: .8 }, TM.corte + 2.6);
  tl.call(() => o.fechar(), null, TM.corte + 9.5);

  // --- Quadro a quadro ---
  let inicio = 0, parado = false, ultimo = 0;
  const alvo = new T.Vector3(), t3 = new T.Vector3();
  function quadro(){
    if (parado) return;
    const agora = performance.now() / 1000, t = agora - inicio;
    if (t - ultimo < (leve ? 1 / 24 : 1 / 45) && t > .3) return;   // modo leve: menos quadros
    ultimo = t;
    // luzes
    const zumbido = .94 + .06 * Math.sin(agora * 61) + (Math.random() < .03 ? -.18 : 0);
    tmp.copy(frio).lerp(verm, S.sangue);
    lampadas.forEach((x, i) => {
      const k = S.luz * zumbido * (i === 2 ? .8 + .2 * Math.sin(agora * 7.3) : 1);
      x.l.intensity = x.I * k * (1 - S.sangue * .35); x.l.color.copy(tmp);
      x.tubo.material.color.setRGB(.8 * k * (1 - S.sangue * .5) + S.sangue * .4 * k, .95 * k * (1 - S.sangue * .8), .85 * k * (1 - S.sangue * .9));
    });
    emerg.intensity = 14 * (.4 + S.redVig) * (S.luz > .5 ? 1 : .3) * (.8 + .2 * Math.sin(agora * 3));
    lanterna.position.copy(cam.position); lanterna.position.y += .1; lanterna.intensity = S.camL * 9 * zumbido; lanterna.color.set(S.sangue > .5 ? 0xff5a60 : 0xbfd2ff);
    // câmera: respiração + tremor
    const tr = S.tremor;
    cam.position.x = Math.sin(agora * .9) * .012 + (Math.random() - .5) * .035 * tr;
    const baseY = 1.15 + S.camY + Math.sin(agora * 1.7) * .01 + (Math.random() - .5) * .03 * tr;
    cam.position.y = baseY;
    alvo.set((Math.random() - .5) * .04 * tr, S.olharY + (Math.random() - .5) * .03 * tr, cam.position.z - 4);
    cam.lookAt(alvo);
    cam.rotation.z += (Math.random() - .5) * .02 * tr;
    // menina
    M.raiz.position.y = Math.sin(agora * 1.4) * .004;
    if (S.twitch > 0 && Math.random() < .12 * S.twitch) { M.cabeca.rotation.z += (Math.random() - .5) * .22 * Math.min(1, S.twitch); M.cabeca.rotation.y = (Math.random() - .5) * .3; }
    else if (S.twitch === 0) M.cabeca.rotation.y *= .8;
    const b = S.boca;
    M.buraco.scale.set(.022 + .01 * b, .004 + .036 * b, .012); M.labio.scale.set((.022 + .01 * b) * 1.04, (.004 + .036 * b) * 1.08, 1);
    M.boca.position.y = -.085 - .028 * b; M.dentesTopo.forEach(d => { d.visible = b > .3; d.position.y = .036 * b * (Math.cos((d.position.x / .8)) * .5) + .014 * b; });
    M.rosto.scale.y = 1 + .12 * b; M.rosto.position.y = HY - .12 * b * HY;
    M.cabelo.uniforms.uTime.value = agora - inicio; M.cabelo.uniforms.uAbrirL.value = S.partE; M.cabelo.uniforms.uAbrirR.value = S.partD; M.cabelo.uniforms.uBalanco.value = S.balanco;
    M.olhos.forEach(e => e.lookAt(cam.position));
    [M.bE, M.bD].forEach((br, i) => { br.ombro.rotation.x += Math.sin(agora * 1.1 + i) * .0008; });
    // pós-processamento
    U.uTime.value = agora; U.uGlitch.value = S.glitch; U.uAber.value = S.aber; U.uRed.value = S.red; U.uFade.value = S.fade; U.uFlash.value = S.flash;
    U.uVig.value = S.vig; U.uGrain.value = S.grain + S.tremor * .06; U.uExpo.value = S.expo; U.uRedVig.value = S.redVig;
    renderer.setRenderTarget(rt); renderer.render(cena, cam);
    renderer.setRenderTarget(null); renderer.render(posCena, posCam);
  }
  const aoRedimensionar = () => {
    W = Math.max(320, Math.round(innerWidth * escala)); H = Math.max(240, Math.round(innerHeight * escala));
    renderer.setSize(W, H, false); rt.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix();
  };
  addEventListener('resize', aoRedimensionar);

  // --- Som e partida ---
  let som = null;
  const sons = o.sons || {};
  if (aud) { try { som = montarAudio(aud.A, { vol: Math.max(.25, o.config.volume / 100), sons, calmo }); } catch (e) { som = null; } }
  inicio = performance.now() / 1000 + .03;
  tl.play(0);
  g.ticker.add(quadro);
  quadro();

  return {
    tl, S, M, cam, rt,
    /* usado nos testes: posiciona a cena em um instante e desenha */
    ir(t){ g.ticker.remove(quadro); tl.pause(); tl.time(t, false); inicio = performance.now() / 1000 - t; ultimo = -9; quadro(); },
    parar(){
      parado = true; g.ticker.remove(quadro); removeEventListener('resize', aoRedimensionar);
      tl.kill();
      if (som) som.parar();
      cena.traverse(n => {
        if (n.geometry) n.geometry.dispose();
        const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
        ms.forEach(m => { ['map', 'emissiveMap'].forEach(k => m[k] && m[k].dispose()); m.dispose(); });
      });
      quad.geometry.dispose(); quad.material.dispose(); rt.dispose();
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
      cv.remove();
    }
  };
}
