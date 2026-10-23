/* Surpresa escondida (botão do rodapé do app).
   Conta em 3 tempos:
     1) O próprio app dela escurece e falha; uma figura pálida aparece mais perto a cada piscada.
     2) Apagão em silêncio. Corredor escuro: o mouse é a lanterna. Ela só anda quando a luz sai de cima dela.
     3) O susto, o corte para o preto e "TE PEGUEI, BRUNO!".
   Só é carregado quando a usuária passa o mouse/clica no botão. O resto do app não depende deste arquivo.
   Usa three.js (corredor e efeitos de imagem) e GSAP + plugins (linha do tempo, textos), todos em vendor/. */
import * as T from '../vendor/three.min.js';
import { pintarMenina, POSES } from './menina.js';

/* Momentos da fase 1, em segundos desde o clique (cada piscada é um único apaga-acende, com mais de 1 s entre elas) */
const TM = { pisca: [1.8, 3.4, 5.0], preto: 5.9, f2: 6.9 };
const SONS = ['ambiente', 'sussurro', 'rangido', 'batida', 'grito'];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

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
   ÁUDIO SINTETIZADO
   A fase 1 é agendada de uma vez. As fases 2 e 3 reagem ao que a pessoa faz (coração acelera perto dela,
   o susto toca na hora em que a luz a encontra), por isso têm funções para chamar na hora certa.
   ============================================================ */
export function montarAudio(A, o){
  const t0 = A.currentTime + .03, vol = o.vol, sons = o.sons || {}, calmo = !!o.calmo, sr = A.sampleRate;
  const agora = () => A.currentTime - t0;
  const nb = sr * 4 | 0, branco = A.createBuffer(1, nb, sr), marrom = A.createBuffer(1, nb, sr);
  { const d = branco.getChannelData(0), m = marrom.getChannelData(0); let l = 0;
    for (let i = 0; i < nb; i++) { const w = Math.random() * 2 - 1; d[i] = w; l = (l + .02 * w) / 1.02; m[i] = l * 3.5; } }
  const ruido = (buf, s, dur, saida) => { const f = A.createBufferSource(); f.buffer = buf; f.loop = true; f.connect(saida); f.start(s, Math.random() * 2); f.stop(s + dur + .05); return f; };

  // Saturação suave segura o pico (o compressor do navegador amplificaria os sons baixos, por isso não é usado)
  const lim = A.createGain();
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
  const osc = (tipo, f, s, e, saida, g) => { const x = A.createOscillator(); x.type = tipo; x.frequency.value = f; const gg = A.createGain(); gg.gain.value = g; x.connect(gg).connect(saida); x.start(at(s)); x.stop(at(e) + .05); return { x, gg }; };
  const tocar = (nome, s, g, saida, laco, fim) => {
    const b = sons[nome]; if (!b) return null;
    const f = A.createBufferSource(), gg = A.createGain(); f.buffer = b; f.loop = !!laco; gg.gain.value = g;
    f.connect(gg).connect(saida || bus); f.start(at(s)); if (fim) f.stop(at(fim)); return f;
  };
  const pan = (p, saida) => { if (!A.createStereoPanner) return saida; const n = A.createStereoPanner(); n.pan.value = p; n.connect(saida); return n; };
  let fim = false;

  // ---- bus: apagão em silêncio ----
  const bg = bus.gain;
  bg.setValueAtTime(1, at(0));
  bg.setValueAtTime(1, at(TM.preto - .05)); bg.linearRampToValueAtTime(.02, at(TM.preto));

  /* Fundo: zumbido grave desafinado + rumor que sobe + zumbido agudo (some no apagão) */
  const dron = A.createGain(); dron.connect(bus);
  dron.gain.setValueAtTime(.12, at(0)); dron.gain.linearRampToValueAtTime(.55, at(TM.preto - .1));
  let ambiente = tocar('ambiente', 0, .5, bus, true);
  if (!ambiente) {
    const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(90, at(0)); lp.frequency.linearRampToValueAtTime(380, at(TM.preto)); lp.connect(dron);
    osc('sawtooth', 49, 0, TM.preto + .2, lp, .12); osc('sawtooth', 49.7, 0, TM.preto + .2, lp, .12); osc('sine', 32.7, 0, TM.preto + .2, dron, .25);
    [110, 116.5, 164.8].forEach(f => { const n = osc('triangle', f, 0, TM.preto, dron, .0001); n.gg.gain.setValueAtTime(.0001, at(0)); n.gg.gain.linearRampToValueAtTime(.05, at(TM.preto - .2)); });
    const r = A.createBiquadFilter(), rg = A.createGain(); r.type = 'bandpass'; r.Q.value = 2.2;
    r.frequency.setValueAtTime(260, at(.5)); r.frequency.exponentialRampToValueAtTime(2400, at(TM.preto));
    rg.gain.setValueAtTime(.0001, at(.5)); rg.gain.exponentialRampToValueAtTime(.12, at(TM.preto - .05));
    ruido(marrom, at(.5), TM.preto, r); r.connect(rg).connect(bus);
  }
  { const z = osc('sine', 7600, 1, TM.preto, bus, .0001); z.gg.gain.setValueAtTime(.0001, at(1)); z.gg.gain.linearRampToValueAtTime(.014, at(TM.preto - .3)); }

  /* Caixinha de música desafinada, que vai "esgotando" até o apagão */
  { const notas = [659.3, 784, 987.8, 880, 784, 659.3, 587.3, 659.3]; let t = 1.3, k = 0;
    while (t < TM.preto - .25) {
      const f = notas[k % notas.length] * Math.pow(2, -(k * 14 + 20) / 1200), vv = .03 + k * .003;
      [[1, 1], [2.01, .35], [3.97, .14]].forEach(([m, a]) => { const n = osc('sine', f * m, t, t + 1.1, bus, .0001); n.gg.gain.setValueAtTime(.0001, at(t)); n.gg.gain.exponentialRampToValueAtTime(vv * a, at(t + .01)); n.gg.gain.exponentialRampToValueAtTime(.0001, at(t + 1.0)); });
      t += .62 * Math.pow(1.06, k); k++;
    } }

  /* Coração */
  const batida = (t, f, saida) => {
    [0, .19].forEach((d, i) => {
      const s = t + d, x = A.createOscillator(), g = A.createGain();
      x.frequency.setValueAtTime(110, at(s)); x.frequency.exponentialRampToValueAtTime(42, at(s + .13));
      g.gain.setValueAtTime(.0001, at(s)); g.gain.exponentialRampToValueAtTime((i ? .5 : .8) * f, at(s + .012)); g.gain.exponentialRampToValueAtTime(.0001, at(s + .2));
      x.connect(g).connect(saida || bus); x.start(at(s)); x.stop(at(s + .25));
    });
  };
  for (let t = .9, iv = .92, k = 0; t < TM.preto - .15; t += iv, iv = Math.max(.5, iv * .93), k++) batida(t, .2 + Math.min(.4, k * .06));

  /* Sussurros: o primeiro ("Bruno...") sai só no ouvido esquerdo */
  const sussurro = (s, p, dur, ganho = 1) => {
    if (tocar('sussurro', s, .8 * ganho, pan(p, bus))) return;
    const saida = pan(p, bus), soma = A.createGain(); soma.connect(saida);
    const voz = A.createOscillator(); voz.type = 'sawtooth'; voz.frequency.setValueAtTime(150, at(s)); voz.frequency.linearRampToValueAtTime(118, at(s + dur));
    const ar = A.createGain(); ar.gain.value = .9; ruido(branco, at(s), dur, ar);
    const entra = A.createGain(); entra.gain.value = .0001; voz.connect(entra); ar.connect(entra);
    [[550, 330, 8], [1500, 2300, 9], [2800, 3200, 10]].forEach(([a, b, q], i) => {
      const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(a, at(s)); bp.frequency.linearRampToValueAtTime(b, at(s + dur));
      const gg = A.createGain(); gg.gain.value = [1, .6, .5][i] * 1.3 * ganho; entra.connect(bp).connect(gg).connect(soma);
    });
    const am = A.createOscillator(), amg = A.createGain(); am.frequency.value = 7; amg.gain.value = .3; am.connect(amg).connect(entra.gain);
    entra.gain.setValueAtTime(.0001, at(s)); entra.gain.linearRampToValueAtTime(.16, at(s + dur * .35)); entra.gain.linearRampToValueAtTime(.0001, at(s + dur));
    voz.start(at(s)); voz.stop(at(s + dur) + .05); am.start(at(s)); am.stop(at(s + dur) + .05);
  };
  sussurro(.45, -1, 1.1); sussurro(2.0, .8, 1.1); sussurro(3.5, -.5, 1.3);

  /* Porta rangendo */
  const rangido = (s, dur, f0, p) => {
    if (tocar('rangido', s, .7, pan(p, bus))) return;
    const x = A.createOscillator(), bp = A.createBiquadFilter(), g = A.createGain(), lf = A.createOscillator(), lg = A.createGain();
    x.type = 'sawtooth'; x.frequency.setValueAtTime(f0, at(s)); x.frequency.linearRampToValueAtTime(f0 * 2.1, at(s + dur * .6)); x.frequency.linearRampToValueAtTime(f0 * 1.6, at(s + dur));
    lf.frequency.value = 17; lg.gain.value = f0 * .1; lf.connect(lg).connect(x.frequency);
    bp.type = 'bandpass'; bp.Q.value = 14; bp.frequency.setValueAtTime(700, at(s)); bp.frequency.linearRampToValueAtTime(1500, at(s + dur));
    g.gain.setValueAtTime(.0001, at(s)); g.gain.linearRampToValueAtTime(.09, at(s + dur * .4)); g.gain.linearRampToValueAtTime(.0001, at(s + dur));
    x.connect(bp).connect(g).connect(pan(p, bus)); x.start(at(s)); lf.start(at(s)); x.stop(at(s + dur) + .05); lf.stop(at(s + dur) + .05);
  };
  rangido(2.6, 1.3, 85, .7); rangido(4.3, .9, 100, -.7);

  /* Cada piscada: "tzzt" ao apagar e "tonk" ao acender */
  const zumbe = t => {
    const hp = A.createBiquadFilter(), g = A.createGain(); hp.type = 'bandpass'; hp.frequency.value = 1800; hp.Q.value = 1.4;
    ruido(branco, at(t), .3, hp); hp.connect(g).connect(bus);
    g.gain.setValueAtTime(.0001, at(t)); g.gain.exponentialRampToValueAtTime(.1, at(t + .01)); g.gain.exponentialRampToValueAtTime(.02, at(t + .08)); g.gain.exponentialRampToValueAtTime(.0001, at(t + .2));
    osc('square', 100, t, t + .2, bus, .025);
    const k = osc('sine', 85, t + .14, t + .36, bus, .0001); k.gg.gain.setValueAtTime(.0001, at(t + .14)); k.gg.gain.exponentialRampToValueAtTime(.22, at(t + .145)); k.gg.gain.exponentialRampToValueAtTime(.0001, at(t + .34));
  };
  TM.pisca.forEach(zumbe);

  /* No escuro: só uma respiração perto do ouvido e um estalo úmido */
  { const bp = A.createBiquadFilter(), g = A.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = .8;
    ruido(marrom, at(TM.preto + .3), .9, bp); bp.connect(g).connect(pan(.2, cru));
    g.gain.setValueAtTime(.0001, at(TM.preto + .3)); g.gain.exponentialRampToValueAtTime(.1, at(TM.preto + .65)); g.gain.exponentialRampToValueAtTime(.0001, at(TM.preto + 1.0));
    const st = A.createBiquadFilter(), sg = A.createGain(); st.type = 'highpass'; st.frequency.value = 3500;
    ruido(branco, at(TM.preto + .62), .04, st); st.connect(sg).connect(pan(-.3, cru));
    sg.gain.setValueAtTime(.0001, at(TM.preto + .62)); sg.gain.exponentialRampToValueAtTime(.03, at(TM.preto + .625)); sg.gain.exponentialRampToValueAtTime(.0001, at(TM.preto + .66)); }

  /* ---------------- Fase 2: lanterna ---------------- */
  let tensao = 0, f2on = false, timerCor = 0, timerSus = 0, drone2 = null;
  const f2 = () => {
    if (f2on || fim) return; f2on = true;
    const t = A.currentTime;
    bg.cancelScheduledValues(t); bg.setValueAtTime(bg.value, t); bg.linearRampToValueAtTime(.8, t + .4);
    // zumbido grave que acompanha a tensão
    const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; const dg = A.createGain(); dg.gain.value = .0001; lp.connect(dg).connect(bus);
    const a = A.createOscillator(), b = A.createOscillator(), c = A.createOscillator(); a.type = 'sawtooth'; b.type = 'sawtooth'; a.frequency.value = 49; b.frequency.value = 49.8; c.frequency.value = 32.7;
    a.connect(lp); b.connect(lp); c.connect(dg); [a, b, c].forEach(n => n.start());
    const rr = A.createBiquadFilter(), rg = A.createGain(); rr.type = 'bandpass'; rr.Q.value = 2; rr.frequency.value = 900; rg.gain.value = .0001;
    const rs = A.createBufferSource(); rs.buffer = marrom; rs.loop = true; rs.connect(rr).connect(rg).connect(bus); rs.start();
    drone2 = { a, b, c, rs, dg, rg, lp, rr };
    const bate = () => { if (fim) return; batida(agora() + .02, .22 + .7 * tensao); timerCor = setTimeout(bate, (1.1 - .72 * tensao) * 1000); };
    const sussurra = () => { if (fim) return; if (tensao > .2) sussurro(agora() + .05, (Math.random() - .5) * 1.8, 1.2, .5 + tensao * .5); timerSus = setTimeout(sussurra, 2600 + Math.random() * 2400); };
    bate(); timerSus = setTimeout(sussurra, 1800);
  };
  const prox = v => {   // 0..1: quanto mais perto dela, mais rápido o coração e mais grave o zumbido
    tensao = clamp(v);
    if (!drone2) return; const t = A.currentTime;
    drone2.dg.gain.setTargetAtTime(.04 + .2 * tensao, t, .15); drone2.rg.gain.setTargetAtTime(.0001 + .09 * tensao * tensao, t, .2);
    drone2.lp.frequency.setTargetAtTime(120 + 500 * tensao, t, .2); drone2.rr.frequency.setTargetAtTime(500 + 2600 * tensao, t, .2);
  };
  const passo = () => {   // ela deu um passo no escuro
    const s = agora() + .02;
    const k = osc('sine', 68, s, s + .25, bus, .0001); k.gg.gain.setValueAtTime(.0001, at(s)); k.gg.gain.exponentialRampToValueAtTime(.4, at(s + .01)); k.gg.gain.exponentialRampToValueAtTime(.0001, at(s + .22));
    const lp = A.createBiquadFilter(), g = A.createGain(); lp.type = 'lowpass'; lp.frequency.value = 600; ruido(marrom, at(s), .15, lp); lp.connect(g).connect(bus);
    g.gain.setValueAtTime(.0001, at(s)); g.gain.exponentialRampToValueAtTime(.25, at(s + .01)); g.gain.exponentialRampToValueAtTime(.0001, at(s + .14));
    if (Math.random() < .5) rangido(s + .05, .5, 90 + Math.random() * 30, (Math.random() - .5) * 1.4);
  };

  /* ---------------- Fase 3: o susto ---------------- */
  const forte = calmo ? .5 : 1;
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
  const susto = (quando) => {
    if (fim) return; fim = true; clearTimeout(timerCor); clearTimeout(timerSus);
    const tB = quando == null ? agora() + .09 : quando, t = at(tB);
    // um instante de silêncio antes da pancada
    bg.cancelScheduledValues(A.currentTime); bg.setValueAtTime(bg.value, A.currentTime); bg.linearRampToValueAtTime(.03, Math.max(A.currentTime + .02, t - .05)); bg.setValueAtTime(1, t);
    if (drone2) { const tt = A.currentTime; drone2.dg.gain.setTargetAtTime(.0001, tt, .05); drone2.rg.gain.setTargetAtTime(.0001, tt, .05); [drone2.a, drone2.b, drone2.c, drone2.rs].forEach(n => { try { n.stop(tt + .4); } catch (e) {} }); }
    if (ambiente) { try { ambiente.stop(t); } catch (e) {} }
    if (!tocar('batida', tB, 1, bus)) {
      const x = A.createOscillator(), g = A.createGain();
      x.frequency.setValueAtTime(150, at(tB)); x.frequency.exponentialRampToValueAtTime(28, at(tB + .9));
      g.gain.setValueAtTime(.0001, at(tB)); g.gain.exponentialRampToValueAtTime(1.1, at(tB + .008)); g.gain.exponentialRampToValueAtTime(.0001, at(tB + 1.1));
      x.connect(g).connect(bus); x.start(at(tB)); x.stop(at(tB + 1.2));
      const lp = A.createBiquadFilter(), ng = A.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, at(tB)); lp.frequency.exponentialRampToValueAtTime(200, at(tB + .5));
      ruido(branco, at(tB), .6, lp); lp.connect(ng).connect(bus); ng.gain.setValueAtTime(1, at(tB)); ng.gain.exponentialRampToValueAtTime(.0001, at(tB + .5));
      const lpv = A.createBiquadFilter(); lpv.type = 'lowpass'; lpv.frequency.value = 4200; lpv.connect(bus);
      [932, 988, 1047, 1109, 1175, 1245].forEach((f, i) => {
        const n = A.createOscillator(), g2 = A.createGain(), l = A.createOscillator(), lg = A.createGain();
        n.type = 'sawtooth'; n.frequency.setValueAtTime(f, at(tB)); n.frequency.exponentialRampToValueAtTime(f * 1.06, at(tB + 1.7)); l.frequency.value = 6 + i * .4; lg.gain.value = f * .012; l.connect(lg).connect(n.frequency);
        g2.gain.setValueAtTime(.0001, at(tB)); g2.gain.exponentialRampToValueAtTime(.04, at(tB + .03)); g2.gain.exponentialRampToValueAtTime(.0001, at(tB + 1.9));
        n.connect(g2).connect(lpv); n.start(at(tB)); l.start(at(tB)); n.stop(at(tB + 2)); l.stop(at(tB + 2));
      });
    }
    if (!tocar('grito', tB + .02, 1 * forte, bus)) {
      voz(tB + .02, 1.9, 1000, 1, -.15); voz(tB + .5, 1.5, 1190, .7, .35); voz(tB + .95, 1.2, 760, .6, -.45);
      const c = A.createOscillator(), m = A.createOscillator(), mg = A.createGain(), hp = A.createBiquadFilter(), g = A.createGain();
      c.frequency.setValueAtTime(2600, at(tB)); c.frequency.exponentialRampToValueAtTime(1700, at(tB + .8)); m.frequency.value = 3700; mg.gain.setValueAtTime(2200, at(tB)); mg.gain.linearRampToValueAtTime(400, at(tB + .8));
      m.connect(mg).connect(c.frequency); hp.type = 'highpass'; hp.frequency.value = 1500;
      g.gain.setValueAtTime(.0001, at(tB)); g.gain.exponentialRampToValueAtTime(.09 * forte, at(tB + .02)); g.gain.exponentialRampToValueAtTime(.0001, at(tB + .85));
      c.connect(hp).connect(g).connect(bus); c.start(at(tB)); m.start(at(tB)); c.stop(at(tB + .9)); m.stop(at(tB + .9));
    }
  };
  /* Corte seco para o escuro: um tom grave e quase nada */
  const corte = (quando) => {
    const tc = at(quando == null ? agora() : quando);
    bg.cancelScheduledValues(A.currentTime); bg.setValueAtTime(bg.value, A.currentTime); bg.setValueAtTime(bg.value, tc - .01); bg.linearRampToValueAtTime(0, tc + .02);
    const x = A.createOscillator(), g = A.createGain(); x.frequency.value = 55; g.gain.setValueAtTime(.0001, tc + .3); g.gain.linearRampToValueAtTime(.06, tc + 1.6); g.gain.linearRampToValueAtTime(.0001, tc + 5);
    x.connect(g).connect(cru); x.start(tc + .3); x.stop(tc + 5.1);
  };

  return {
    f2, prox, passo, susto, corte, sussurro: (p, g) => sussurro(agora() + .05, p, 1.1, g),
    parar(){
      fim = true; clearTimeout(timerCor); clearTimeout(timerSus);
      const t = A.currentTime;
      try { master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + .18); } catch (e) {}
      if (drone2) [drone2.a, drone2.b, drone2.c, drone2.rs].forEach(n => { try { n.stop(t + .25); } catch (e) {} });
      setTimeout(() => { try { lim.disconnect(); master.disconnect(); } catch (e) {} }, 400);
    }
  };
}

/* Sussurro solto e baixinho (usado no "eco" depois que o susto fecha) */
function sussurroSolto(A, vol){
  const sr = A.sampleRate, n = sr * 1.4 | 0, b = A.createBuffer(1, n, sr), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = A.createBufferSource(), bp = A.createBiquadFilter(), bp2 = A.createBiquadFilter(), g = A.createGain(), p = A.createStereoPanner ? A.createStereoPanner() : null;
  s.buffer = b; bp.type = 'bandpass'; bp.frequency.setValueAtTime(520, A.currentTime); bp.frequency.linearRampToValueAtTime(330, A.currentTime + 1.1); bp.Q.value = 7;
  bp2.type = 'bandpass'; bp2.frequency.value = 2100; bp2.Q.value = 6;
  const t = A.currentTime; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.35 * vol, t + .4); g.gain.linearRampToValueAtTime(.0001, t + 1.2);
  s.connect(bp).connect(g); s.connect(bp2).connect(g);
  if (p) { p.pan.value = .85; g.connect(p).connect(A.destination); } else g.connect(A.destination);
  s.start(t); s.stop(t + 1.4);
}

/* ============================================================
   TEXTURAS DO CORREDOR (desenhadas aqui, sem imagens externas)
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
/* ============================================================
   PÓS-PROCESSAMENTO: grão, aberração, falha, vinheta, vermelho e a LANTERNA (máscara que segue o mouse)
   ============================================================ */
const FS_POS = `
uniform sampler2D tDiffuse;
uniform vec2 uMouse;
uniform float uTime, uGlitch, uAber, uRed, uFade, uFlash, uVig, uGrain, uExpo, uRedVig, uRaio, uAsp, uEscuro, uLant;
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
  float dm = length((uv - uMouse) * vec2(uAsp, 1.0));
  float lz = smoothstep(uRaio, uRaio * 0.2, dm);
  lz *= 0.93 + 0.07 * h(vec2(passo, 7.0));
  c *= mix(1.0, mix(uEscuro, 1.0, lz), uLant);
  c *= mix(vec3(1.0), vec3(1.08, 1.0, 0.86), lz * uLant);
  c += vec3(0.05, 0.043, 0.03) * lz * uLant;
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
  const g = o.gsap, leve = !!o.leve, calmo = !!o.calmo, win = window;
  try { g.registerPlugin(...[win.SplitText, win.ScrambleTextPlugin, win.CustomWiggle, win.CustomEase, win.RoughEase].filter(Boolean)); } catch (e) {}
  const rugoso = (forca, pts) => win.RoughEase ? win.RoughEase.ease.config({ strength: forca, points: pts, taper: 'out', randomize: true, clamp: true }) : 'none';
  if (win.CustomWiggle) { try { win.CustomWiggle.create('susto-trem', { wiggles: 14, type: 'uniform' }); } catch (e) {} }
  let golpe = 'expo.out'; const arrasto = 'steps(7)';   // ela se aproxima aos trancos
  if (win.CustomEase) { try { golpe = win.CustomEase.create('susto-golpe', 'M0,0 C0,0.75 0.04,1.06 0.2,1.06 0.5,1.06 0.7,1 1,1'); } catch (e) {} }

  const msg = el.querySelector('.susto-msg'), fim = el.querySelector('.susto-fim'), fimB = fim.querySelector('b'), fimS = fim.querySelector('small');
  msg.textContent = '';
  const camada = (cls, tag, antes) => { const n = document.createElement(tag || 'div'); n.className = cls; n.setAttribute('aria-hidden', 'true'); el.insertBefore(n, antes || msg); return n; };
  const figCv = camada('susto-fig', 'canvas'), pisca = camada('susto-pisca'), clarao = camada('susto-clarao');
  const dica = document.createElement('div'); dica.className = 'susto-esc'; dica.textContent = 'Esc para sair'; el.appendChild(dica);
  g.set(figCv, { opacity: 0 }); g.set(pisca, { opacity: 0 }); g.set(clarao, { opacity: 0 });
  el.style.setProperty('--sa', 0);
  const timers = [];

  /* ---------- a menina (quadros pintados por código; os pesados vão sendo pintados aos poucos) ---------- */
  const quadros = {};
  const pintar = p => quadros[p] || (quadros[p] = pintarMenina(p));
  pintar('baixa');
  POSES.slice(1).forEach((p, i) => timers.push(setTimeout(() => pintar(p), 250 + i * 330)));
  const fctx = figCv.getContext('2d'); figCv.width = 512; figCv.height = 1024;
  const desenharFig = p => { fctx.clearRect(0, 0, 512, 1024); fctx.drawImage(pintar(p), 0, 0); };

  /* ---------- texto ---------- */
  const letras = (txt, pai) => [...txt].map(c => { const s = document.createElement('span'); s.textContent = c; s.setAttribute('aria-hidden', 'true'); pai.appendChild(s); return s; });
  const dividir = (d, txt) => {
    d.textContent = txt;
    if (win.SplitText) { try { return win.SplitText.create(d, { type: 'chars' }).chars; } catch (e) {} }
    d.textContent = ''; return letras(txt, d);
  };
  const tl1 = g.timeline({ paused: true });
  const fala = (txt, t, dur, tipo, tl = tl1) => {
    const d = document.createElement('div'); d.className = 'fala' + (tipo === 'grito' ? ' grito' : ''); d.setAttribute('role', 'img'); d.setAttribute('aria-label', txt); msg.appendChild(d);
    if (tipo === 'scramble' && win.ScrambleTextPlugin) {
      d.textContent = '▓'.repeat(txt.length);
      tl.fromTo(d, { opacity: 0, filter: 'blur(10px)' }, { opacity: 1, filter: 'blur(0px)', duration: .4 }, t);
      tl.to(d, { duration: .9, scrambleText: { text: txt, chars: '▓▒░#%&01', revealDelay: .15, speed: .6 } }, t);
      tl.to(d, { opacity: 0, filter: 'blur(12px)', y: -8, duration: .45, ease: 'power2.in' }, t + dur);
      return;
    }
    const sp = dividir(d, txt), grito = tipo === 'grito';
    tl.fromTo(sp, { opacity: 0, filter: 'blur(14px)', y: 16, scale: 1.8, color: '#ff2638' },
      { opacity: 1, filter: 'blur(0px)', y: 0, scale: 1, color: grito ? '#ff3a48' : '#ece0dc', duration: grito ? .3 : .6, ease: 'power3.out', stagger: grito ? .035 : .06 }, t);
    if (grito && !calmo) tl.to(sp, { x: 'random(-3,3)', y: 'random(-2,2)', duration: .05, repeat: 6, ease: 'none' }, t + .3);
    tl.to(sp, { opacity: 0, filter: 'blur(12px)', y: -10, duration: .42, ease: 'power2.in', stagger: { each: .02, from: 'random' } }, t + dur);
  };

  /* ---------- o app dela como cenário ---------- */
  const h1 = document.querySelector('.marca h1'), h1Orig = h1 ? h1.textContent : '';
  const restaurarApp = () => {
    document.body.classList.remove('susto-corrompe'); document.body.style.removeProperty('--sj');
    if (h1) { g.killTweensOf(h1); h1.textContent = h1Orig; h1.style.removeProperty('opacity'); h1.style.removeProperty('filter'); }
  };
  const ptr = { x: .2, y: .3, t: -99, visto: false };
  const aoMover = e => { ptr.x = e.clientX / innerWidth; ptr.y = 1 - e.clientY / innerHeight; ptr.t = performance.now() / 1000; ptr.visto = true; };
  el.addEventListener('pointermove', aoMover);

  tl1.set(el, { '--sa': 0 }, 0);
  tl1.to(el, { '--sa': .36, duration: 1.6, ease: 'power1.in' }, 0).to(el, { '--sa': .54, duration: 1.4, ease: 'none' }, 1.8).to(el, { '--sa': .7, duration: 1.4, ease: 'none' }, 3.4);
  if (!calmo) {
    tl1.call(() => document.body.classList.add('susto-corrompe'), null, .2);
    tl1.to(document.body, { '--sj': 3, duration: 5, ease: 'none' }, .4);
    if (h1 && win.ScrambleTextPlugin) tl1.to(h1, { duration: 1.1, scrambleText: { text: 'Bruno', chars: '▓▒░#%&', speed: .5 } }, 2.8);
  }
  // figura pálida: cada piscada a mostra mais perto (nunca a vemos andando)
  const est = [{ p: 'baixa', x: '88%', h: '25vh' }, { p: 'inclinada', x: '73%', h: '47vh' }, { p: 'olho', x: '57%', h: '86vh' }];
  TM.pisca.forEach((t, i) => {
    const e = est[i];
    if (!calmo) tl1.set(pisca, { opacity: 1 }, t).set(pisca, { opacity: 0 }, t + .14);
    tl1.call(() => desenharFig(e.p), null, t + .03);
    tl1.set(figCv, { left: e.x, height: e.h }, t + .03);
    if (calmo) tl1.fromTo(figCv, { opacity: 0 }, { opacity: .9, duration: .8 }, t + .03); else tl1.set(figCv, { opacity: .92 }, t + .04);
  });
  fala('Bruno...', .5, 1.0);
  fala('você ouviu isso?', 2.05, 1.0);
  fala('ela já sabe o seu nome', 3.55, 1.15, 'scramble');
  fala('NÃO PISQUE', 4.4, .55, 'grito');
  // apagão
  tl1.set(pisca, { opacity: 1 }, TM.preto).set(el, { '--sa': 1 }, TM.preto).set(figCv, { opacity: 0 }, TM.preto);
  tl1.call(() => { restaurarApp(); msg.textContent = ''; }, null, TM.preto + .02);
  tl1.call(() => entrarFase2(), null, TM.preto + .06);
  tl1.call(() => iniciarFase2(), null, TM.f2);

  /* ============================================================
     FASE 2 e 3: corredor 3D com lanterna. Só existe se o WebGL funcionar e se a pessoa não pediu menos movimento.
     ============================================================ */
  let R3 = null, estado = 'f1', som = null, f2ini = 0, tlS = null, tlF2 = null, finalOK = false;
  const S = { luz: .55, fade: 1, glitch: 0, aber: .5, red: 0, vig: 1, redVig: .35, flash: 0, expo: 1.2, tremor: .05, grain: .1, sangue: 0, lant: 1, camY: 0, fov: 66, esc: 1, sz: -9.5, sx: .5, cabY: 1.4, olharY: 1.2, estilo: 0 };
  const ETAPAS = [{ z: -9.5, p: 'baixa' }, { z: -7.6, p: 'baixa' }, { z: -5.8, p: 'baixa' }, { z: -4.2, p: 'inclinada' }, { z: -3.0, p: 'inclinada' }, { z: -2.1, p: 'olho' }];
  const cena3 = { etapa: 0, lit: 0, unlit: 0, pose: 'baixa', dist: 9 };

  function montar3D(){
    const cv = document.createElement('canvas'); cv.className = 'susto-3d'; cv.setAttribute('aria-hidden', 'true');
    const renderer = new T.WebGLRenderer({ canvas: cv, antialias: false, alpha: false, powerPreference: 'high-performance' });
    const escala = leve ? .5 : .72;
    let W = Math.max(320, Math.round(innerWidth * escala)), H = Math.max(240, Math.round(innerHeight * escala));
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 1);
    el.insertBefore(cv, figCv);
    const cena = new T.Scene(); cena.fog = new T.FogExp2(0x040203, .075);
    const cam = new T.PerspectiveCamera(66, W / H, .04, 60); cam.position.set(0, 1.15, .15);
    const rt = new T.WebGLRenderTarget(W, H, { depthBuffer: true, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    const posCena = new T.Scene(), posCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const U = { tDiffuse: { value: rt.texture }, uTime: { value: 0 }, uGlitch: { value: 0 }, uAber: { value: 0 }, uRed: { value: 0 }, uFade: { value: 1 }, uFlash: { value: 0 }, uVig: { value: 1 }, uGrain: { value: .1 }, uExpo: { value: 1 }, uRedVig: { value: 0 }, uMouse: { value: new T.Vector2(.5, .5) }, uRaio: { value: .2 }, uAsp: { value: W / H }, uEscuro: { value: .03 }, uLant: { value: 1 } };
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: U, depthTest: false, depthWrite: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FS_POS }));
    posCena.add(quad);

    // corredor
    const CL = 40, CW = 3.2, CH = 2.8;
    const tParede = texDe(cvParede(), 14, 1), tParede2 = texDe(cvParede(), 14, 1), tFim = texDe(cvParede(), 1, 1);
    const tChao = texDe(cvChao(), 2, 25), tTeto = texDe(cvTeto(), 3, 30);
    const mat = (map, cor) => new T.MeshStandardMaterial({ map, color: cor || 0xffffff, roughness: .92, side: T.BackSide });
    const corredor = new T.Mesh(new T.BoxGeometry(CW, CH, CL), [mat(tParede), mat(tParede2), mat(tTeto), new T.MeshStandardMaterial({ map: tChao, roughness: .45, metalness: .1, side: T.BackSide }), mat(tFim), mat(tFim)]);
    corredor.position.set(0, CH / 2, 2 - CL / 2); cena.add(corredor);
    const matPorta = new T.MeshStandardMaterial({ color: 0x1d1612, roughness: .8 }), matFresta = new T.MeshBasicMaterial({ color: 0x000000 });
    [[-1, -5.5], [1, -8.5], [-1, -12.5], [1, -16], [-1, -20.5], [1, -25]].forEach(([lado, z], i) => {
      const grp = new T.Group(); grp.position.set(lado * (CW / 2 - .02), 1.05, z); grp.rotation.y = -lado * Math.PI / 2;
      grp.add(new T.Mesh(new T.PlaneGeometry(1.1, 2.18), new T.MeshStandardMaterial({ color: 0x0c0907, roughness: 1 })));
      const porta = new T.Mesh(new T.PlaneGeometry(.95, 2.08), matPorta); porta.position.z = .004; grp.add(porta);
      if (i === 2 || i === 4) { const f = new T.Mesh(new T.PlaneGeometry(.07, 2.08), matFresta); f.position.set(.36, 0, .008); grp.add(f); }
      cena.add(grp);
    });
    const frio = new T.Color(0xcfe8d4), verm = new T.Color(0xff1020), tmp = new T.Color();
    const lampadas = [[-3, 42], [-10, 42], [-17, 46]].map(([z, I]) => {
      const l = new T.PointLight(0xcfe8d4, I, 0, 2); l.position.set(0, 2.45, z); cena.add(l);
      const tubo = new T.Mesh(new T.BoxGeometry(.22, .035, 1.3), new T.MeshBasicMaterial({ color: 0x000000 })); tubo.position.set(0, CH - .03, z); cena.add(tubo);
      return { l, tubo, I };
    });
    const emerg = new T.PointLight(0xff1020, 0, 0, 2); emerg.position.set(0, 2.2, -26); cena.add(emerg);
    cena.add(new T.AmbientLight(0x2a1a22, .9));

    // ela: um quadro 2D em pé no corredor
    const texCache = {};
    const texPose = p => { if (texCache[p]) return texCache[p]; const t = new T.CanvasTexture(pintar(p)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return (texCache[p] = t); };
    const spr = new T.Mesh(new T.PlaneGeometry(.875, 1.75), new T.MeshBasicMaterial({ map: texPose('baixa'), transparent: true, depthWrite: false, depthTest: false, fog: true }));
    spr.renderOrder = 3; cena.add(spr);
    const setPose = p => { if (cena3.pose !== p) { cena3.pose = p; spr.material.map = texPose(p); } };
    return { cv, renderer, cena, cam, rt, U, quad, posCena, posCam, lampadas, emerg, frio, verm, tmp, spr, setPose, texCache, aoRedim(){ W = Math.max(320, Math.round(innerWidth * escala)); H = Math.max(240, Math.round(innerHeight * escala)); renderer.setSize(W, H, false); rt.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); U.uAsp.value = W / H; } };
  }

  function entrarFase2(){
    if (calmo || estado !== 'f1') return;
    try { R3 = montar3D(); addEventListener('resize', R3.aoRedim); } catch (e) { R3 = null; }
  }
  const alvo = new T.Vector3(), cab3 = new T.Vector3();
  let ultimoQ = 0, inicio3 = 0;
  function quadro3(){
    if (!R3 || estado === 'fim') return;
    const { renderer, cena, cam, rt, U, lampadas, emerg, frio, verm, tmp, spr, setPose } = R3;
    const agora = performance.now() / 1000, dt = Math.min(.06, agora - ultimoQ || .016);
    if (agora - ultimoQ < (leve ? 1 / 24 : 1 / 45) && ultimoQ) return; ultimoQ = agora;
    const sc = cena3, aspecto = U.uAsp.value;

    // sprite: posição e escala
    const Hs = 1.75 * S.esc, scare = estado === 'susto' || estado === 'fim-cena';
    spr.scale.setScalar(S.esc); spr.position.x = (S.sx - .5) * 1.2;
    spr.position.z = S.sz;
    spr.position.y = scare ? S.cabY - (.5 - 196 / 1024) * Hs : .875 * S.esc;
    // cabeça projetada na tela (para saber se a lanterna está em cima dela)
    cab3.set(spr.position.x, spr.position.y + (.5 - 230 / 1024) * Hs, spr.position.z).project(cam);
    const hx = (cab3.x + 1) / 2, hy = (cab3.y + 1) / 2;

    if (estado === 'f2') {
      const t = agora - f2ini, ocioso = agora - ptr.t;
      const vaga = { x: .5 + .34 * Math.sin(t * .75), y: .5 + .16 * Math.sin(t * 1.15 + 1) };
      const base = ocioso < 2.4 && ptr.visto ? ptr : (ptr.visto || t > 2.4 ? vaga : { x: ptr.x, y: ptr.y });
      const forca = Math.max(clamp((ocioso - 2.4) / 3.6), clamp((t - 11) / 4));
      const a = { x: base.x + (hx - base.x) * forca, y: base.y + (hy - base.y) * forca };
      const k = 1 - Math.exp(-dt * 9);
      luzP.x += (a.x - luzP.x) * k; luzP.y += (a.y - luzP.y) * k;
      const raio = (matchMedia('(pointer: coarse)').matches ? .27 : .2) * (1 + .03 * Math.sin(agora * 23) + (Math.random() < .02 ? -.2 : 0));
      const dist = Math.hypot((luzP.x - hx) * aspecto, luzP.y - hy);
      const aceso = dist < raio * .85;
      sc.lit = aceso ? sc.lit + dt : Math.max(0, sc.lit - dt * 2);
      sc.unlit = aceso ? 0 : sc.unlit + dt;
      U.uMouse.value.set(luzP.x, luzP.y); U.uRaio.value = raio;
      // no escuro ela anda, mas só um passo de cada vez e sem ser vista
      if (!aceso && sc.unlit > 1.15 && sc.etapa < ETAPAS.length - 1) {
        sc.etapa++; sc.unlit = -.5; S.sz = ETAPAS[sc.etapa].z; setPose(ETAPAS[sc.etapa].p); som && som.passo();
        S.sx = .5 + (Math.random() - .5) * .22;
      }
      if (aceso) {
        if (sc.lit > .45 && sc.pose === 'baixa') { setPose('inclinada'); }
        if (sc.lit > .8 && sc.pose !== 'olho') { setPose('olho'); }
        spr.rotation.z = Math.random() < .3 ? (Math.random() - .5) * .04 : spr.rotation.z;
      } else spr.rotation.z *= .8;
      const limite = sc.etapa >= ETAPAS.length - 1 ? .5 : 1.1;
      if (sc.lit > limite) dispararSusto();
      som && som.prox(clamp(.18 + .13 * sc.etapa + (aceso ? .3 : 0) + .2 * clamp(1 - dist / (raio * 3))));
    }
    if (scare && S.estilo) {   // quadro a quadro: alterna duas caras a 12 por segundo
      const f = Math.floor(agora * 12) % 2; setPose(f ? 'grito2' : 'grito'); spr.position.x += (f ? .012 : -.012) * S.esc;
    }
    // luzes do corredor
    const zumbido = .94 + .06 * Math.sin(agora * 61) + (Math.random() < .03 ? -.18 : 0);
    tmp.copy(frio).lerp(verm, S.sangue);
    lampadas.forEach((x, i) => {
      const kk = S.luz * zumbido * (i === 2 ? .8 + .2 * Math.sin(agora * 7.3) : 1);
      x.l.intensity = x.I * kk * (1 - S.sangue * .35); x.l.color.copy(tmp);
      x.tubo.material.color.setRGB(.8 * kk * (1 - S.sangue * .5) + S.sangue * .4 * kk, .95 * kk * (1 - S.sangue * .8), .85 * kk * (1 - S.sangue * .9));
    });
    emerg.intensity = 14 * (.4 + S.redVig) * (.8 + .2 * Math.sin(agora * 3));
    spr.material.color.setScalar(scare ? 1 : .9);
    // câmera: respiração + tremor
    const tr = S.tremor;
    cam.position.x = Math.sin(agora * .9) * .012 + (Math.random() - .5) * .035 * tr;
    cam.position.y = 1.15 + S.camY + Math.sin(agora * 1.7) * .01 + (Math.random() - .5) * .03 * tr;
    alvo.set((Math.random() - .5) * .04 * tr, S.olharY + (Math.random() - .5) * .03 * tr, cam.position.z - 4);
    cam.lookAt(alvo); cam.rotation.z += (Math.random() - .5) * .02 * tr;
    if (cam.fov !== S.fov) { cam.fov = S.fov; cam.updateProjectionMatrix(); }
    // imagem
    U.uTime.value = agora; U.uGlitch.value = S.glitch; U.uAber.value = S.aber; U.uRed.value = S.red; U.uFade.value = S.fade; U.uFlash.value = S.flash;
    U.uVig.value = S.vig; U.uGrain.value = S.grain + S.tremor * .06; U.uExpo.value = S.expo; U.uRedVig.value = S.redVig; U.uLant.value = S.lant;
    renderer.setRenderTarget(rt); renderer.render(cena, cam);
    renderer.setRenderTarget(null); renderer.render(R3.posCena, R3.posCam);
  }
  const luzP = { x: .2, y: .3 };

  function iniciarFase2(){
    if (estado !== 'f1') return;
    if (!R3) { cenaFinal2D(); return; }
    estado = 'f2'; f2ini = performance.now() / 1000; ptr.t = f2ini;
    el.classList.add('f2');
    if (ptr.visto) { luzP.x = ptr.x; luzP.y = ptr.y; }
    S.sz = ETAPAS[0].z; S.sx = .5 + (Math.random() < .5 ? -.12 : .12);
    S.fade = 0; S.lant = 1; S.luz = .55;
    g.ticker.add(quadro3); quadro3();
    som && som.f2();
    g.to(pisca, { opacity: 0, duration: .8 });
    const tf2 = g.timeline(); tlF2 = tf2; fala('procure...', .35, 1.2, 'blur', tf2);
    timers.push(setTimeout(() => { if (estado === 'f2') msg.textContent = ''; }, 2400));
  }

  /* ---------- o susto (3D) ---------- */
  function dispararSusto(){
    if (estado !== 'f2') return; estado = 'susto';
    som && som.susto();
    const B = .09, T_ = 1.9;
    tlS = g.timeline();
    tlS.set(S, { lant: 0, luz: 1, flash: calmo ? 0 : 1, glitch: calmo ? 0 : .6, aber: calmo ? .8 : 3.2, red: .62, redVig: .85, sangue: 1, vig: 1.15, tremor: calmo ? .1 : 1.6, estilo: calmo ? 0 : 1, olharY: 1.4, camY: .25, sz: -1.35, esc: 1.7 }, B);
    tlS.call(() => R3.setPose('grito'), null, B);
    if (!calmo) {
      tlS.to(S, { flash: 0, duration: .55, ease: 'power2.out' }, B + .05);
      tlS.to(S, { sz: -.95, esc: 1.9, duration: .12, ease: golpe }, B + .01);
      tlS.to(S, { fov: 82, duration: .1, ease: 'power4.out' }, B).to(S, { fov: 68, duration: 1.4, ease: 'power2.out' }, B + .1);
      tlS.to(S, { tremor: .35, duration: 1.4, ease: 'power3.out' }, B + .06);
      tlS.to(S, { glitch: .25, duration: .5, ease: 'power2.out' }, B + .1);
      tlS.set(S, { glitch: .5 }, B + .62).to(S, { glitch: .2, duration: .3 }, B + .65);
      tlS.to(S, { aber: 1.6, duration: 1, ease: 'power2.out' }, B + .1);
      if (win.CustomWiggle) tlS.to(R3.cv, { x: 16, y: -8, duration: .7, ease: 'susto-trem' }, B);
      tlS.to(S, { sz: -.55, esc: 2.1, duration: T_ - .25, ease: arrasto }, B + .2);
      tlS.to(S, { aber: 3, glitch: .6, duration: .8, ease: 'power2.in' }, B + 1.0);
    } else {
      tlS.to(S, { sz: -1.0, duration: 1.4, ease: 'power1.out' }, B + .05);
    }
    tlS.to(S, { red: .4, duration: 1.6, ease: 'power1.out' }, B + .3);
    // corte seco para o escuro
    const C = B + T_;
    tlS.call(() => { som && som.corte(); estado = 'fim-cena'; }, null, C);
    tlS.set(S, { fade: 1, glitch: 1 }, C);
    tlS.to(S, { fade: .62, glitch: .1, tremor: .4, red: .65, duration: 1.3, ease: 'power2.out' }, C + .35);
    textoFinal(tlS, C + .3);
  }

  /* ---------- sem 3D (ou movimento reduzido): ela aparece grande, em 2D ---------- */
  function cenaFinal2D(){
    if (estado === 'fim' || estado === 'susto') return; estado = 'susto';
    pintar('grito'); pintar('grito2');
    const B = .09, T_ = 1.9, tf = g.timeline();
    g.set(figCv, { left: '50%', bottom: '-62vh', height: '170vh', x: 0, xPercent: -50, transformOrigin: '50% 19%', scale: 1, opacity: 0, filter: 'brightness(1.1) contrast(1.25) saturate(.8)' });
    el.classList.add('f2'); el.style.setProperty('--sa', 1);
    som && som.susto();
    tlS = tf;
    tf.set(figCv, { opacity: 1 }, B).call(() => desenharFig('grito'), null, B);
    if (!calmo) {
      tf.set(clarao, { opacity: 1 }, B).to(clarao, { opacity: 0, duration: .55, ease: 'power2.out' }, B + .05);
      tf.fromTo(figCv, { scale: .85 }, { scale: 1.05, duration: .14, ease: golpe }, B);
      tf.to(figCv, { scale: 1.35, duration: T_ - .2, ease: arrasto }, B + .2);
      if (win.CustomWiggle) tf.to(figCv, { x: 14, y: -8, duration: .7, ease: 'susto-trem' }, B);
      tf.to({}, { duration: T_, onUpdate(){ const f = Math.floor(this.time() * 12) % 2; if (f !== tf._f) { tf._f = f; desenharFig(f ? 'grito2' : 'grito'); } } }, B);
    } else tf.fromTo(figCv, { opacity: 0 }, { opacity: 1, duration: .9 }, B);
    const C = B + T_;
    tf.call(() => { som && som.corte(); }, null, C);
    tf.set(pisca, { opacity: 1 }, C).to(pisca, { opacity: .38, duration: 1.2, ease: 'power2.out' }, C + .35);
    textoFinal(tf, C + .3);
  }

  /* ---------- texto final ---------- */
  function textoFinal(tl, t){
    tl.call(() => { el.classList.add('fim'); finalOK = true; }, null, t);
    const sp = dividir(fimB, 'TE PEGUEI, BRUNO!');
    tl.fromTo(sp, { opacity: 0, filter: 'blur(18px)', y: 34, scale: 2.4, rotation: 'random(-9,9)' },
      { opacity: 1, filter: 'blur(0px)', y: 0, scale: 1, rotation: 0, duration: .75, ease: 'expo.out', stagger: .06 }, t + .15);
    tl.fromTo(fimS, { opacity: 0 }, { opacity: 1, duration: .8 }, t + 2.3);
    tl.call(() => o.fechar(), null, t + 9.5);
  }

  /* ---------- som e partida ---------- */
  const sons = o.sons || {};
  if (o.actx && o.config.sons) { try { som = montarAudio(o.actx, { vol: Math.max(.25, o.config.volume / 100), sons, calmo }); } catch (e) { som = null; } }
  tl1.play(0);

  return {
    tl1, S, cena3,
    get R3(){ return R3; }, get estado(){ return estado; }, get tlS(){ return tlS; },
    get completo(){ return finalOK; },
    /* usado nos testes */
    forcar(o2){
      if (o2.f1 != null) { tl1.pause(); tl1.time(o2.f1, false); }
      if (o2.f2) { tl1.pause(); tl1.time(TM.f2 + .9, false); ptr.visto = true; }
      if (o2.luz) { ptr.x = o2.luz[0]; ptr.y = o2.luz[1]; ptr.visto = true; ptr.t = performance.now() / 1000; }
      if (o2.etapa != null) { cena3.etapa = o2.etapa; S.sz = ETAPAS[o2.etapa].z; R3.setPose(ETAPAS[o2.etapa].p); }
      if (o2.susto) dispararSusto();
      if (o2.sT != null && tlS) { tlS.pause(); tlS.time(o2.sT, false); }
      if (o2.desenhar) { g.ticker.remove(quadro3); ultimoQ = 0; quadro3(); }
    },
    parar(){
      estado = 'fim'; g.ticker.remove(quadro3); removeEventListener('resize', R3 && R3.aoRedim); el.removeEventListener('pointermove', aoMover);
      timers.forEach(clearTimeout); tl1.kill(); tlS && tlS.kill(); tlF2 && tlF2.kill();
      g.killTweensOf([figCv, pisca, clarao, el, document.body, S]);
      restaurarApp();
      if (som) som.parar();
      if (R3) {
        R3.cena.traverse(n => {
          if (n.geometry) n.geometry.dispose();
          const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
          ms.forEach(m => { ['map', 'emissiveMap'].forEach(k => m[k] && m[k].dispose()); m.dispose(); });
        });
        Object.values(R3.texCache).forEach(t => t.dispose());
        R3.quad.geometry.dispose(); R3.quad.material.dispose(); R3.rt.dispose();
        R3.renderer.dispose(); try { R3.renderer.forceContextLoss(); } catch (e) {}
        R3.cv.remove(); R3 = null;
      }
      [figCv, pisca, clarao, dica].forEach(n => n.remove());
    }
  };
}

/* ============================================================
   ECO: um vulto rápido no canto da tela, um pouco depois do susto fechar (só uma vez, sem atrapalhar)
   ============================================================ */
export function eco(o){
  const g = o.gsap, c = pintarMenina('olho'), v = document.createElement('canvas');
  v.width = 512; v.height = 1024; v.getContext('2d').drawImage(c, 0, 0); v.className = 'susto-eco'; v.setAttribute('aria-hidden', 'true');
  document.body.appendChild(v);
  const fim = () => v.remove();
  g.set(v, { opacity: 0 });
  g.timeline({ onComplete: fim })
    .set(v, { opacity: .8 }, .15).set(v, { opacity: 0 }, .27).set(v, { opacity: .9 }, .4).set(v, { opacity: 0 }, .95);
  if (o.actx && o.config.sons) { try { if (o.actx.state === 'suspended') o.actx.resume(); setTimeout(() => sussurroSolto(o.actx, Math.max(.25, o.config.volume / 100)), 120); } catch (e) {} }
  return { cancelar: fim };
}
