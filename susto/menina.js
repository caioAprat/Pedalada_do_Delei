/* A menina do susto, pintada em 2D por código (sem imagens externas).
   Cada pose é um quadro de 512x1024 com fundo transparente: ela está em pé, com os pés na borda de baixo.
   Poses: baixa (cabeça baixa, cabelo cobrindo tudo), inclinada, olho (cabelo aberto, um olho aparece),
          grito, grito2 (boca e olhos ainda mais abertos). */
export const POSES = ['baixa', 'inclinada', 'olho', 'grito', 'grito2'];
export const LARG = 512, ALT = 1024;

function semente(n){ let s = n; return () => (s = s * 16807 % 2147483647) / 2147483647; }

export function pintarMenina(pose){
  const c = document.createElement('canvas'); c.width = LARG; c.height = ALT;
  const g = c.getContext('2d'), R = semente(101 + POSES.indexOf(pose) * 17);
  const grito = pose === 'grito' || pose === 'grito2', maior = pose === 'grito2';
  const OMB = 342;   // altura dos ombros

  /* ---------- helpers ---------- */
  const mancha = (x, y, rx, ry, cor, a) => { const o = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry)); o.addColorStop(0, `rgba(${cor},${a})`); o.addColorStop(1, `rgba(${cor},0)`); g.fillStyle = o; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
  const fio = (pts, w, cor) => { g.strokeStyle = cor; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0], pts[1]); g.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]); g.stroke(); };

  /* ---------- cabelo de trás (volume escuro atrás de tudo) ---------- */
  const cab = { x: 256, y: grito ? 196 : pose === 'olho' ? 214 : pose === 'inclinada' ? 236 : 262 };
  const inclina = pose === 'inclinada' ? -.2 : pose === 'olho' ? .07 : pose === 'grito2' ? -.1 : pose === 'baixa' ? .05 : 0;
  const esc = maior ? 1.17 : grito ? 1.1 : 1;
  { const gr = g.createLinearGradient(0, 90, 0, 880); gr.addColorStop(0, '#050506'); gr.addColorStop(1, '#010101');
    g.fillStyle = gr; g.beginPath();
    g.moveTo(cab.x - 74 * esc, cab.y - 20);
    g.bezierCurveTo(cab.x - 100 * esc, cab.y - 120 * esc, cab.x + 100 * esc, cab.y - 120 * esc, cab.x + 74 * esc, cab.y - 20);
    g.bezierCurveTo(cab.x + 120, 420, cab.x + 150, 700, cab.x + 120 + R() * 20, 880);
    g.lineTo(cab.x - 130 - R() * 20, 880);
    g.bezierCurveTo(cab.x - 150, 700, cab.x - 120, 420, cab.x - 74 * esc, cab.y - 20);
    g.fill(); }

  /* ---------- vestido ---------- */
  { g.save();
    const forma = () => {
      g.beginPath(); g.moveTo(208, OMB - 6); g.lineTo(304, OMB - 6);
      g.bezierCurveTo(318, OMB + 40, 330, 560, 410, 880); g.lineTo(424, ALT);
      for (let x = 424; x > 92; x -= 18 + R() * 14) g.lineTo(x, ALT - (R() < .5 ? R() * 46 : R() * 8));
      g.lineTo(88, ALT); g.lineTo(102, 880);
      g.bezierCurveTo(182, 560, 194, OMB + 40, 208, OMB - 6); g.closePath();
    };
    forma();
    let gr = g.createLinearGradient(0, OMB, 0, ALT); gr.addColorStop(0, '#d4d3c8'); gr.addColorStop(.55, '#a3a298'); gr.addColorStop(1, '#4b4b44');
    g.fillStyle = gr; g.fill(); g.clip();
    // volume lateral
    gr = g.createLinearGradient(90, 0, 424, 0); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(.3, 'rgba(0,0,0,0)'); gr.addColorStop(.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = gr; g.fillRect(80, OMB - 10, 360, ALT);
    // dobras e escorridos
    for (let i = 0; i < 46; i++) { const x = 160 + R() * 192, h = 80 + R() * 520; g.strokeStyle = `rgba(30,25,18,${.05 + R() * .16})`; g.lineWidth = .8 + R() * 2.4; g.beginPath(); g.moveTo(x, OMB + R() * 200); g.bezierCurveTo(x + (R() - .5) * 30, OMB + h * .4, x + (R() - .5) * 60, OMB + h * .7, x + (R() - .5) * 80, OMB + h); g.stroke(); }
    for (let i = 0; i < 26; i++) mancha(130 + R() * 250, 560 + R() * 460, 8 + R() * 34, 10 + R() * 46, R() < .4 ? '96,16,12' : '48,36,24', .18 + R() * .35);
    for (let i = 0; i < 8; i++) { const x = 170 + R() * 170; g.strokeStyle = 'rgba(110,14,10,.55)'; g.lineWidth = 2 + R() * 3; g.beginPath(); g.moveTo(x, 600 + R() * 200); g.lineTo(x + (R() - .5) * 8, 760 + R() * 240); g.stroke(); }
    g.restore(); }

  /* ---------- braços e mãos ---------- */
  const pele = '#8b9387', peleEsc = '#3d443d';
  const braco = (lado) => {
    const sx = 256 + lado * 52, sy = OMB + 6;
    const alvo = grito ? [256 + lado * (maior ? 190 : 170), 250 + (maior ? -10 : 20)] : [256 + lado * (62 + R() * 14), 700 + R() * 20];
    const cot = grito ? [256 + lado * 128, 440] : [256 + lado * (78 + R() * 10), 520];
    [[peleEsc, 22], [pele, 15]].forEach(([cor, w], k) => { g.strokeStyle = cor; g.lineWidth = w - (k ? 0 : 0); g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cot[0], cot[1], alvo[0], alvo[1]); g.stroke(); });
    // mão com dedos compridos
    for (let i = 0; i < 5; i++) {
      const comp = (i === 0 ? 54 : 74) + R() * 12;
      const base = grito ? (lado > 0 ? -.9 + (i - 2) * .38 : Math.PI + .9 - (i - 2) * .38) : 1.57 + (i - 2) * .15;
      const ex = alvo[0] + Math.cos(base) * comp, ey = alvo[1] + Math.sin(base) * comp;
      g.strokeStyle = peleEsc; g.lineWidth = 6.5; g.beginPath(); g.moveTo(alvo[0], alvo[1]); g.quadraticCurveTo((alvo[0] + ex) / 2 + (R() - .5) * 18, (alvo[1] + ey) / 2 + (R() - .5) * 10, ex, ey); g.stroke();
      g.strokeStyle = pele; g.lineWidth = 3.6; g.beginPath(); g.moveTo(alvo[0], alvo[1]); g.quadraticCurveTo((alvo[0] + ex) / 2 + (R() - .5) * 18, (alvo[1] + ey) / 2 + (R() - .5) * 10, ex, ey); g.stroke();
      g.fillStyle = '#c6c0a2'; g.beginPath(); g.arc(ex, ey, 2.3, 0, 7); g.fill();
    }
  };
  braco(-1); braco(1);

  /* ---------- pescoço ---------- */
  { const gr = g.createLinearGradient(230, 0, 282, 0); gr.addColorStop(0, '#2d332d'); gr.addColorStop(.5, '#9aa296'); gr.addColorStop(1, '#2d332d');
    g.fillStyle = gr; g.beginPath(); g.moveTo(236, cab.y + 60); g.lineTo(276, cab.y + 60); g.lineTo(282, OMB); g.lineTo(230, OMB); g.closePath(); g.fill(); }

  /* ---------- cabeça e rosto ---------- */
  g.save(); g.translate(cab.x, cab.y); g.rotate(inclina); g.scale(esc, esc);
  const cabeca = () => { g.beginPath(); g.moveTo(0, -94); g.bezierCurveTo(70, -94, 72, -6, 52, 46); g.bezierCurveTo(40, 80, 20, 100, 0, 104); g.bezierCurveTo(-20, 100, -40, 80, -52, 46); g.bezierCurveTo(-72, -6, -70, -94, 0, -94); g.closePath(); };
  cabeca();
  let gr = g.createRadialGradient(-10, -20, 8, 0, 10, 120); gr.addColorStop(0, '#d9dccf'); gr.addColorStop(.45, '#a3aa9d'); gr.addColorStop(.8, '#586057'); gr.addColorStop(1, '#222823');
  g.fillStyle = gr; g.fill(); g.save(); cabeca(); g.clip();
  mancha(-40, 28, 26, 34, '10,12,10', .5); mancha(40, 28, 26, 34, '10,12,10', .5);          // maçãs do rosto fundas
  mancha(0, 96, 40, 20, '0,0,0', .55);                                                          // queixo
  for (let i = 0; i < 150; i++) mancha((R() - .5) * 120, (R() - .5) * 190, 2 + R() * 9, 2 + R() * 7, R() < .55 ? '40,55,50' : '110,35,35', R() * .16);
  g.strokeStyle = 'rgba(50,72,105,.4)'; g.lineWidth = 1;                                          // veias
  for (let i = 0; i < 16; i++) { let x = (R() - .5) * 110, y = -40 + R() * 90; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - .5) * 14; y += 4 + R() * 9; g.lineTo(x, y); } g.stroke(); }
  g.strokeStyle = 'rgba(20,10,10,.55)'; g.lineWidth = .9;                                          // rachaduras
  for (let i = 0; i < 12; i++) { let x = (R() - .5) * 100, y = (R() - .5) * 150; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R() - .5) * 18; y += (R() - .3) * 16; g.lineTo(x, y); } g.stroke(); }
  g.restore();

  const olho = (x, y, r, forca) => {
    mancha(x, y + 2, r * 2.5, r * 2.1, '2,0,1', 1 * forca); mancha(x, y + 2, r * 1.5, r * 1.2, '0,0,0', .9 * forca);
    g.save(); g.beginPath(); g.ellipse(x, y, r * 1.18, r * .86, 0, 0, 7); g.clip();
    const o = g.createRadialGradient(x, y, 2, x, y, r * 1.3); o.addColorStop(0, '#e4dcc6'); o.addColorStop(.55, '#bfae8c'); o.addColorStop(1, '#6a2a22');
    g.fillStyle = o; g.fillRect(x - r * 1.3, y - r, r * 2.6, r * 2);
    g.strokeStyle = 'rgba(185,15,18,.85)'; g.lineWidth = .8;
    for (let i = 0; i < 22; i++) { const a = R() * 6.28; let px = x + Math.cos(a) * r * 1.15, py = y + Math.sin(a) * r * .84; g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (x - px) * .22 + (R() - .5) * 3; py += (y - py) * .22 + (R() - .5) * 3; g.lineTo(px, py); } g.stroke(); }
    const ir = g.createRadialGradient(x, y, 1, x, y, r * .42); ir.addColorStop(0, '#050505'); ir.addColorStop(.3, '#0a0a0a'); ir.addColorStop(.38, '#767a74'); ir.addColorStop(.9, '#30332f'); ir.addColorStop(1, '#0a0a0a');
    g.fillStyle = ir; g.beginPath(); g.arc(x, y, r * .42, 0, 7); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, r * .13, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x + r * .18, y - r * .17, r * .08, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(8,2,4,.9)'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, r * 1.2, r * .88, 0, 0, 7); g.stroke();
  };
  const rr = maior ? 15.5 : grito ? 13.5 : 12;
  olho(-27, -16, rr, 1); olho(27, -14, rr * (maior ? 1.1 : .96), 1);
  // nariz
  g.strokeStyle = 'rgba(25,22,20,.55)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-2, -4); g.quadraticCurveTo(-7, 22, -6, 30); g.stroke();
  g.fillStyle = 'rgba(10,6,6,.8)'; g.beginPath(); g.ellipse(-6, 33, 3, 2, 0, 0, 7); g.ellipse(6, 33, 3, 2, 0, 0, 7); g.fill();
  // lágrimas escuras que escorrem dos olhos
  [-27, 27].forEach((x, i) => { g.strokeStyle = 'rgba(8,2,3,.85)'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(x + (i ? 4 : -4), -2); g.bezierCurveTo(x + (i ? 10 : -10), 24, x + (i ? 2 : -2), 60, x + (i ? 8 : -8), 96); g.stroke(); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 8, 0); g.lineTo(x + 12, 40 + R() * 20); g.stroke(); });
  // boca
  const bw = maior ? 30 : grito ? 25 : 18, bh = maior ? 48 : grito ? 38 : 14, by = 62;
  { const lg = g.createRadialGradient(0, by, 2, 0, by, bh); lg.addColorStop(0, '#000'); lg.addColorStop(.7, '#120305'); lg.addColorStop(1, '#4a1418');
    g.fillStyle = lg; g.beginPath(); g.ellipse(0, by, bw, bh, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(88,48,52,.95)'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, by, bw + 2, bh + 2, 0, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(20,6,8,.9)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, by, bw + 6, bh + 6, 0, 0, 7); g.stroke();
    if (grito) {
      g.save(); g.beginPath(); g.ellipse(0, by, bw, bh, 0, 0, 7); g.clip();
      g.fillStyle = 'rgba(190,176,128,.9)';
      for (let i = 0; i < 8; i++) { const x = -bw + 4 + i * (bw * 2 - 8) / 7; g.beginPath(); g.moveTo(x - 4, by - bh); g.lineTo(x + 1, by - bh + 12 + R() * 7); g.lineTo(x + 5, by - bh); g.fill(); }
      g.fillStyle = 'rgba(150,138,100,.7)'; for (let i = 0; i < 5; i++) { const x = -bw * .6 + i * (bw * 1.2) / 4; g.beginPath(); g.moveTo(x - 3, by + bh); g.lineTo(x + 1, by + bh - 9 - R() * 6); g.lineTo(x + 4, by + bh); g.fill(); }
      mancha(0, by + bh * .45, bw * .6, bh * .3, '90,10,16', .7);
      g.restore();
    }
    // cantos da boca rasgados
    g.strokeStyle = 'rgba(20,6,8,.8)'; g.lineWidth = 1.6; [-1, 1].forEach(l => { g.beginPath(); g.moveTo(l * bw, by - 2); g.lineTo(l * (bw + 12 + R() * 8), by - 10 - R() * 8); g.stroke(); }); }
  g.restore();   // fim da cabeça

  /* ---------- cabelo da frente ---------- */
  // abertura (onde o rosto aparece), em coordenadas relativas ao centro da cabeça
  const vao = { baixa: null, inclinada: [-9, 5], olho: [-58, -6], grito: [-68, 68], grito2: [-72, 72] }[pose];
  g.save(); g.translate(cab.x, cab.y); g.rotate(inclina); g.scale(esc, esc);
  // massa escura por baixo dos fios (sem frestas por onde apareça o vestido)
  { g.save();
    const cortina = l => { g.beginPath(); g.moveTo(l * 58, -100); g.bezierCurveTo(l * 84, -70, l * 92, -20, l * 86, 40); g.bezierCurveTo(l * 96, 200, l * 116, 500, l * 136, 800); g.lineTo(l * 62, 800); g.bezierCurveTo(l * 58, 500, l * 60, 250, l * 62, 100); g.bezierCurveTo(l * 62, 40, l * 66, -40, l * 58, -100); g.closePath(); g.fill(); };
    const gm = g.createLinearGradient(0, -90, 0, 800); gm.addColorStop(0, '#030304'); gm.addColorStop(.78, '#010101'); gm.addColorStop(1, 'rgba(1,1,1,0)'); g.fillStyle = gm;
    if (!grito) {
      g.beginPath(); g.rect(-300, -300, 600, 1400);
      if (vao) g.rect(vao[0], -92, vao[1] - vao[0], 200);
      g.clip('evenodd');
      g.beginPath(); g.moveTo(0, -106); g.bezierCurveTo(62, -106, 80, -70, 80, -30); g.bezierCurveTo(88, 150, 100, 420, 112, 800); g.lineTo(-112, 800); g.bezierCurveTo(-100, 420, -88, 150, -80, -30); g.bezierCurveTo(-80, -70, -62, -106, 0, -106); g.closePath(); g.fill();
    } else { cortina(-1); cortina(1); }
    g.restore(); }
  const N = 900, clumps = Array.from({ length: 16 }, () => (R() - .5) * 26);
  for (let i = 0; i < N; i++) {
    let x0 = (R() - .5) * 156, topo = -98 + Math.abs(x0) * .3 + R() * 10;
    let lado = x0 < 0 ? -1 : 1;
    if (vao && x0 > vao[0] && x0 < vao[1]) { // empilha nas bordas da abertura
      const perto = (x0 - vao[0]) < (vao[1] - x0) ? vao[0] : vao[1]; x0 = perto + (R() - .5) * 16; lado = perto === vao[0] ? -1 : 1; topo = -84 + R() * 40;
    }
    const comp = grito ? 420 + R() * 260 : 440 + R() * 300, desv = lado * (6 + R() * 26) + clumps[(x0 + 80) / 10 | 0 & 15] * .6, tom = 2 + R() * 10 | 0, onda = (R() - .5) * 34;
    const aberto = vao ? 1.25 : 1;
    g.strokeStyle = R() < .05 ? `rgba(110,120,140,${.1 + R() * .12})` : `rgba(${tom},${tom},${tom + 2},${.6 + R() * .4})`;
    g.lineWidth = .7 + R() * (grito ? 2.8 : 3.4); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, topo);
    g.bezierCurveTo(x0 + desv * .4 * aberto + onda, topo + comp * .22, x0 + desv * aberto - onda * 1.2 + (R() - .5) * 20, topo + comp * .58, x0 + desv * 1.3 * aberto + onda * .8 + (R() - .5) * 40, topo + comp);
    g.stroke();
  }
  // fios soltos e colados no rosto (molhados)
  g.strokeStyle = 'rgba(4,4,6,.85)'; g.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) { const x = (R() - .5) * 110, y = -40 + R() * 100; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (R() - .5) * 30, y + 20, x + (R() - .5) * 40, y + 50, x + (R() - .5) * 20, y + 80 + R() * 40); g.stroke(); }
  g.restore();

  /* ---------- acabamento: sombra de contato e grão ---------- */
  g.globalCompositeOperation = 'source-atop';
  gr = g.createLinearGradient(0, ALT - 120, 0, ALT); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = gr; g.fillRect(0, ALT - 120, LARG, 120);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R() < .5 ? '0,0,0' : '255,255,255'},${R() * .05})`; g.fillRect(R() * LARG, R() * ALT, 1 + R() * 2, 1 + R() * 2); }
  g.globalCompositeOperation = 'source-over';
  return c;
}
