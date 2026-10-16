/* Yerleşim Stüdyosu – nesne kütüphanesi
 * Yeni nesne eklemek için bu dosyanın sonuna bir LS.register({...}) bloğu ekleyin.
 * Kurallar:
 *   - type anahtarını kaydedilmiş JSON'lar kullanır; yayınladıktan sonra değiştirmeyin.
 *   - build(p, ctx) içinde nesneyi MERKEZİ (0,0) olacak şekilde çizin. Ölçüler mm.
 *   - p: defaults + kullanıcının panelden girdiği değerler.
 *   - Seçim kutusu ve çakışma kontrolü çizilen gövdeden otomatik hesaplanır.
 */

// Ortak parametre tanımları
const P_W = {key: 'w', label: 'Genişlik (X)', type: 'number', unit: 'mm', min: 10, step: 10};
const P_D = {key: 'd', label: 'Derinlik (Y)', type: 'number', unit: 'mm', min: 10, step: 10};
const P_H = {key: 'h', label: 'Yükseklik', type: 'number', unit: 'mm', min: 1, step: 10};
const P_C = {key: 'color', label: 'Renk', type: 'color'};

/* ---------------- Temel ---------------- */
LS.register({
  type: 'kutu', label: 'Kutu', category: 'Temel', icon: '■',
  defaults: {w: 600, d: 400, h: 800, color: '#8A9A91', opak: true},
  params: [P_W, P_D, P_H, P_C, {key: 'opak', label: 'Opak', type: 'check'}],
  build(p, c) { c.box(0, 0, 0, p.w, p.d, p.h, p.color, p.opak ? {} : {opacity: .4}); },
});
LS.register({
  type: 'duvar', label: 'Duvar', category: 'Temel', icon: '▬',
  defaults: {w: 3000, d: 100, h: 2400, color: '#C9D3CD'},
  params: [P_W, P_D, P_H, P_C],
  build(p, c) { c.box(0, 0, 0, p.w, p.d, p.h, p.color, {opacity: .85}); },
});
LS.register({
  type: 'kolon', label: 'Kolon', category: 'Temel', icon: '●',
  defaults: {w: 400, d: 400, h: 3000, color: '#A8B4AD', yuvarlak: false},
  params: [P_W, P_D, P_H, P_C, {key: 'yuvarlak', label: 'Yuvarlak', type: 'check'}],
  build(p, c) { p.yuvarlak ? c.cyl(0, 0, 0, Math.min(p.w, p.d) / 2, p.h, p.color) : c.box(0, 0, 0, p.w, p.d, p.h, p.color); },
});
LS.register({
  type: 'bolge', label: 'Zemin alanı', category: 'Temel', icon: '▢', solid: false,
  defaults: {w: 2000, d: 1500, h: 5, color: '#1E7A4C', etiket: 'Alan'},
  params: [P_W, P_D, P_C, {key: 'etiket', label: 'Zemin yazısı', type: 'text'}],
  build(p, c) { c.box(0, 0, 0, p.w, p.d, 5, p.color, {opacity: .22}); if (p.etiket) c.text(p.etiket, 0, 0, 20, 'obj-floor'); },
});
LS.register({
  type: 'not', label: 'Not / etiket', category: 'Temel', icon: '✎', solid: false,
  defaults: {w: 200, d: 200, h: 10, color: '#B07A0B', metin: 'Not', yukseklik: 1500},
  params: [{key: 'metin', label: 'Metin', type: 'text'}, {key: 'yukseklik', label: 'Yazı yüksekliği', type: 'number', unit: 'mm', min: 0, step: 100}, P_C],
  build(p, c) { c.cyl(0, 0, 0, 60, 10, p.color); c.line([[0, 0, 0], [0, 0, p.yukseklik]], p.color); c.text(p.metin, 0, 0, p.yukseklik, 'obj-note'); },
});

/* ---------------- Taşıma ---------------- */
function conveyorPts(shape, w, d, b) {      // sol-ön köşe orijinli; kollar +X ve +Y yönünde
  b = Math.max(50, Math.min(b, w - 20, d - 20));
  if (shape === 'U') return [[0, 0], [w, 0], [w, d], [w - b, d], [w - b, b], [b, b], [b, d], [0, d]];
  if (shape === 'pah') { const q = b * 0.414; return [[b, 0], [w, 0], [w, b], [b + q, b], [b, b + q], [b, d], [0, d], [0, b]]; }
  if (shape === 'kavis') {
    const o = [], n = 24;
    for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI / 2; o.push([w + w * Math.cos(a), d + d * Math.sin(a)]); }
    for (let i = n; i >= 0; i--) { const a = Math.PI + i / n * Math.PI / 2; o.push([w + (w - b) * Math.cos(a), d + (d - b) * Math.sin(a)]); }
    return o;
  }
  return [[0, 0], [w, 0], [w, b], [b, b], [b, d], [0, d]];
}
function buildShapedConveyor(p, c, shape) {
  const pts = conveyorPts(shape, p.w, p.d, p.bant).map(([x, y]) => [x - p.w / 2, y - p.d / 2]);
  c.poly(pts, p.h - 80, 78, '#2E3B35'); c.poly(pts, p.h - 2, 6, p.color);
  const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  pts.filter((q, i) => shape !== 'kavis' || i % 12 === 0).forEach(([x, y]) => {
    const dx = cx - x, dy = cy - y, L = Math.hypot(dx, dy) || 1;
    c.box(x + dx / L * 45, y + dy / L * 45, 0, 40, 40, p.h - 80, '#5E6E66'); });
}
const CONV_PARAMS = [P_W, P_D, P_H, {key: 'bant', label: 'Bant genişliği', type: 'number', unit: 'mm', min: 50, step: 10}, P_C];
LS.register({
  type: 'konveyor', label: 'Konveyör (düz)', category: 'Taşıma', icon: '═',
  defaults: {w: 2000, d: 400, h: 850, bant: 300, color: '#1E7A4C', ok: true},
  params: [{key: 'w', label: 'Uzunluk (X)', type: 'number', unit: 'mm', min: 100, step: 50},
    {key: 'd', label: 'Gövde genişliği', type: 'number', unit: 'mm', min: 50, step: 10}, P_H,
    {key: 'bant', label: 'Bant genişliği', type: 'number', unit: 'mm', min: 50, step: 10}, P_C,
    {key: 'ok', label: 'Akış yönü oku', type: 'check'}],
  build(p, c) {
    c.box(0, 0, p.h - 80, p.w, p.d, 78, '#2E3B35');
    c.box(0, 0, p.h - 2, p.w, Math.min(p.bant, p.d), 6, p.color);
    for (let x = -p.w / 2 + 60; x <= p.w / 2 - 60; x += Math.max(400, (p.w - 120) / Math.max(1, Math.round((p.w - 120) / 1200)))) {
      c.box(x, -p.d / 2 + 30, 0, 40, 40, p.h - 80, '#5E6E66'); c.box(x, p.d / 2 - 30, 0, 40, 40, p.h - 80, '#5E6E66'); }
    if (p.ok) { const a = Math.min(200, p.w / 4), y0 = p.h + 8;
      c.poly([[p.w / 2 - 40 - a, -a / 2], [p.w / 2 - 40, 0], [p.w / 2 - 40 - a, a / 2]], y0, 4, '#FFFFFF', {edges: false, pick: false}); }
  },
});
LS.register({type: 'konveyor_l', label: 'Konveyör köşe 90°', category: 'Taşıma', icon: '└',
  defaults: {w: 1000, d: 1000, h: 850, bant: 300, color: '#1E7A4C'}, params: CONV_PARAMS, build: (p, c) => buildShapedConveyor(p, c, 'L')});
LS.register({type: 'konveyor_pah', label: 'Konveyör pah 45°', category: 'Taşıma', icon: '◣',
  defaults: {w: 1000, d: 1000, h: 850, bant: 300, color: '#1E7A4C'}, params: CONV_PARAMS, build: (p, c) => buildShapedConveyor(p, c, 'pah')});
LS.register({type: 'konveyor_kavis', label: 'Konveyör kavis', category: 'Taşıma', icon: '◜',
  defaults: {w: 1000, d: 1000, h: 850, bant: 300, color: '#1E7A4C'}, params: CONV_PARAMS, build: (p, c) => buildShapedConveyor(p, c, 'kavis')});
LS.register({type: 'konveyor_u', label: 'Konveyör U dönüş', category: 'Taşıma', icon: '⊔',
  defaults: {w: 1000, d: 1000, h: 850, bant: 300, color: '#1E7A4C'}, params: CONV_PARAMS, build: (p, c) => buildShapedConveyor(p, c, 'U')});
LS.register({
  type: 'ray', label: 'Lineer ray', category: 'Taşıma', icon: '⇔',
  defaults: {w: 1500, d: 200, h: 250, color: '#35524A'},
  params: [{key: 'w', label: 'Strok (X)', type: 'number', unit: 'mm', min: 100, step: 50}, P_D, P_H, P_C],
  build(p, c) { c.box(0, 0, 0, p.w, p.d, p.h, p.color); c.box(-p.w / 2 + 150, 0, p.h, 300, p.d + 60, 40, '#2E3B35'); },
});

/* ---------------- İstasyon ---------------- */
LS.register({
  type: 'masa', label: 'Masa', category: 'İstasyon', icon: '╥',
  defaults: {w: 800, d: 450, h: 900, color: '#4F8A6B'},
  params: [P_W, P_D, P_H, P_C],
  build(p, c) { c.table(p.w, p.d, p.h, p.color); },
});
LS.register({
  type: 'raf', label: 'Raf', category: 'İstasyon', icon: '☰',
  defaults: {w: 1000, d: 400, h: 1800, color: '#8A9A91', kat: 4},
  params: [P_W, P_D, P_H, {key: 'kat', label: 'Kat sayısı', type: 'number', min: 1, max: 10, step: 1}, P_C],
  build(p, c) {
    const n = Math.max(1, Math.round(p.kat));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => c.box(sx * (p.w / 2 - 20), sy * (p.d / 2 - 20), 0, 40, 40, p.h, '#5E6E66'));
    const step = n > 1 ? (p.h - 140) / (n - 1) : 0;
    for (let i = 0; i < n; i++) c.box(0, 0, 100 + i * step, p.w, p.d, 25, p.color);
  },
});
LS.register({
  type: 'makine', label: 'Makine / kabin', category: 'İstasyon', icon: '▣',
  defaults: {w: 800, d: 600, h: 1800, color: '#2E6FD8', govde: 900},
  params: [P_W, P_D, P_H, {key: 'govde', label: 'Gövde yüksekliği', type: 'number', unit: 'mm', min: 0, step: 50}, P_C],
  build(p, c) {
    const g = Math.min(p.govde, p.h); c.box(0, 0, 0, p.w, p.d, g, '#35524A');
    if (p.h > g) c.box(0, 0, g, p.w - 60, p.d - 60, p.h - g, p.color, {opacity: .5});
  },
});
LS.register({
  type: 'robot', label: 'Robot kol', category: 'İstasyon', icon: '⚙',
  defaults: {w: 300, d: 300, h: 1100, color: '#F2F5F3', erisim: 1000, erisimGoster: true},
  params: [{key: 'h', label: 'Toplam yükseklik', type: 'number', unit: 'mm', min: 300, step: 50},
    {key: 'erisim', label: 'Erişim yarıçapı', type: 'number', unit: 'mm', min: 100, step: 50},
    {key: 'erisimGoster', label: 'Erişimi göster', type: 'check'}, P_C],
  build(p, c) {
    const k = p.h / 1100;
    c.cyl(0, 0, 0, 110, 150 * k, p.color); c.sphere(0, 0, 220 * k, 75, '#1E7A4C');
    c.cyl(0, 0, 220 * k, 55, 420 * k, p.color); c.sphere(0, 0, 640 * k, 65, '#1E7A4C');
    c.box(190 * k, 0, 600 * k, 380 * k, 90, 90, p.color); c.box(380 * k, 0, 520 * k, 70, 70, 120, '#123B2C');
    if (p.erisimGoster) c.cyl(0, 0, 2, p.erisim, 2, '#2BA36B', {opacity: .12, pick: false, seg: 64});
  },
});

/* ---------------- İnsan ---------------- */
LS.register({
  type: 'operator', label: 'Operatör', category: 'İnsan', icon: '☺', solid: false,
  defaults: {w: 500, d: 500, h: 1750, color: '#8FB9A3', ad: ''},
  params: [{key: 'ad', label: 'Etiket', type: 'text'}, P_H, P_C],
  build(p, c) {
    c.cyl(0, 0, 0, 160, p.h * .82, p.color, {rTop: 140, opacity: .75}); c.sphere(0, 0, p.h * .9, 110, p.color, {opacity: .75});
    c.cyl(0, 0, 1, 250, 2, p.color, {opacity: .25, pick: true});
    if (p.ad) c.text(p.ad, 0, 0, p.h + 150, 'obj-note');
  },
});

/* ---------------- Ölçü ---------------- */
LS.register({
  type: 'olcu', label: 'Ölçü çizgisi', category: 'Ölçü', icon: '↔', solid: false,
  defaults: {w: 1000, d: 60, h: 10, color: '#123B2C', uzunluk: 1000},
  params: [{key: 'uzunluk', label: 'Uzunluk', type: 'number', unit: 'mm', min: 10, step: 10}, P_C],
  build(p, c) {
    const L = p.uzunluk, z = 15;
    c.box(0, 0, 0, L, 12, 12, p.color, {edges: false});
    c.box(-L / 2, 0, 0, 12, 160, 12, p.color, {edges: false}); c.box(L / 2, 0, 0, 12, 160, 12, p.color, {edges: false});
    c.text(`${Math.round(L)} mm`, 0, 0, z + 60, 'obj-dim');
  },
});
