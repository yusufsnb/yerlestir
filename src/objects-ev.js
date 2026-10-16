/* Yerleşim Stüdyosu – ev eşyaları kütüphanesi
 * Tüm tipler "ev_" ön ekiyle başlar. Kayıtlı JSON'lar bu anahtarları kullanır; DEĞİŞTİRMEYİN.
 * Varsayılan ölçüler yaygın piyasa ölçüleridir. Gerçek ürün ölçüsünü panelden girin.
 * Bu dosya objects.js'ten SONRA yüklenmelidir (P_W, P_D, P_H, P_C oradan gelir).
 */
(() => {
  const shade = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
  // Sınırları verilen kutu: x0..x1, y0..y1 (mm, merkeze göre)
  const boxR = (c, x0, x1, y0, y1, z, h, color, o) =>
    c.box((x0 + x1) / 2, (y0 + y1) / 2, z, Math.abs(x1 - x0), Math.abs(y1 - y0), h, color, o);
  // Ön yüze (y = -d/2) çizgi: pts = [[x, z], ...]
  const front = (c, d, pts, color = '#123B2C') => c.line(pts.map(([x, z]) => [x, -d / 2 - 2, z]), color);
  const circleFront = (c, d, cx, cz, r, color) => {
    const pts = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); }
    front(c, d, pts, color);
  };
  const ZONE = {opacity: .12, pick: false, edges: false};

  // Sandalye: (cx, cy) merkez, ang = sırtlığın baktığı yön (0: +Y arka, 90: +X, 180: -Y, 270: -X)
  function chair(c, cx, cy, ang, color, w = 450, d = 480, h = 880, seat = 450) {
    const rot = (x, y) => { const a = ang * Math.PI / 180, ca = Math.round(Math.cos(a)), sa = Math.round(Math.sin(a)); return [cx + x * ca + y * sa, cy - x * sa + y * ca]; };
    const part = (x, y, z, pw, pd, ph, col) => { const [px, py] = rot(x, y), sw = ang % 180 !== 0; c.box(px, py, z, sw ? pd : pw, sw ? pw : pd, ph, col); };
    const lx = w / 2 - 25, ly = d / 2 - 25;
    [[-lx, -ly], [lx, -ly], [-lx, ly], [lx, ly]].forEach(([x, y]) => part(x, y, 0, 30, 30, seat - 40, '#5E6E66'));
    part(0, 0, seat - 40, w, d, 40, color);
    part(0, d / 2 - 15, seat, w, 30, h - seat, color);
  }

  /* ================= Ev · Yapı ================= */
  LS.register({
    type: 'ev_oda', label: 'Oda (4 duvar)', category: 'Ev · Yapı', icon: '⬚', solid: false,
    defaults: {w: 4000, d: 3500, h: 2600, t: 150, color: '#D5DCD8', kapiW: 900, kapiX: 0, alcak: true},
    params: [{key: 'w', label: 'İç genişlik (X)', type: 'number', unit: 'mm', min: 500, step: 50},
      {key: 'd', label: 'İç derinlik (Y)', type: 'number', unit: 'mm', min: 500, step: 50},
      {key: 'h', label: 'Duvar yüksekliği', type: 'number', unit: 'mm', min: 100, step: 50},
      {key: 't', label: 'Duvar kalınlığı', type: 'number', unit: 'mm', min: 50, step: 10},
      {key: 'kapiW', label: 'Ön duvar kapı boşluğu', type: 'number', unit: 'mm', min: 0, step: 50},
      {key: 'kapiX', label: 'Boşluk konumu (merkezden)', type: 'number', unit: 'mm', step: 50},
      {key: 'alcak', label: 'Duvarları alçak göster', type: 'check'}, P_C],
    build(p, c) {
      const {w, d, t} = p, h = p.alcak ? Math.min(p.h, 900) : p.h, o = {opacity: .9};
      boxR(c, -w / 2 - t, w / 2 + t, d / 2, d / 2 + t, 0, h, p.color, o);           // arka
      boxR(c, -w / 2 - t, -w / 2, -d / 2, d / 2, 0, h, p.color, o);                  // sol
      boxR(c, w / 2, w / 2 + t, -d / 2, d / 2, 0, h, p.color, o);                    // sağ
      const kw = Math.min(Math.max(0, p.kapiW), w - 100);                            // ön (kapı boşluklu)
      if (kw > 0) {
        const k0 = Math.max(-w / 2, Math.min(w / 2 - kw, p.kapiX - kw / 2)), k1 = k0 + kw;
        boxR(c, -w / 2 - t, k0, -d / 2 - t, -d / 2, 0, h, p.color, o);
        boxR(c, k1, w / 2 + t, -d / 2 - t, -d / 2, 0, h, p.color, o);
        if (h > 2150) boxR(c, k0, k1, -d / 2 - t, -d / 2, 2100, h - 2100, p.color, o);   // kapı üstü lento
      } else boxR(c, -w / 2 - t, w / 2 + t, -d / 2 - t, -d / 2, 0, h, p.color, o);
      c.box(0, 0, 0, w, d, 2, '#1E7A4C', ZONE);
      c.text(`${(w * d / 1e6).toFixed(1)} m²`, 0, -d / 2 + 250, 20, 'obj-floor');   // ad etiketi merkezde, alan önde
    },
  });
  LS.register({
    type: 'ev_kapi', label: 'Kapı', category: 'Ev · Yapı', icon: '🚪', solid: false,
    defaults: {w: 900, d: 150, h: 2100, color: '#B98C5E', mentese: 'sol', yon: 'arka', acik: true},
    params: [{key: 'w', label: 'Kasa genişliği', type: 'number', unit: 'mm', min: 500, step: 10},
      {key: 'd', label: 'Duvar kalınlığı', type: 'number', unit: 'mm', min: 50, step: 10}, P_H,
      {key: 'mentese', label: 'Menteşe', type: 'select', options: [['sol', 'Sol'], ['sag', 'Sağ']]},
      {key: 'yon', label: 'Açılış yönü', type: 'select', options: [['arka', 'Arkaya (+Y)'], ['on', 'Öne (−Y)']]},
      {key: 'acik', label: 'Açık göster', type: 'check'}, P_C],
    build(p, c) {
      const W = p.w, t = p.d, fr = 50, L = W - 2 * fr, frC = shade(p.color, .75);
      c.box(-W / 2 + fr / 2, 0, 0, fr, t, p.h, frC); c.box(W / 2 - fr / 2, 0, 0, fr, t, p.h, frC);
      c.box(0, 0, p.h - fr, W - 2 * fr, t, fr, frC);
      const dir = p.mentese === 'sol' ? 1 : -1, hx = -dir * (W / 2 - fr), sy = p.yon === 'arka' ? 1 : -1, hy = sy * t / 2;
      if (p.acik) c.box(hx + dir * 20, hy + sy * L / 2, 0, 40, L, p.h - fr - 10, p.color);
      else c.box(0, 0, 0, L, 40, p.h - fr - 10, p.color);
      const arc = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI / 2; arc.push([hx + dir * L * Math.cos(a), hy + sy * L * Math.sin(a)]); }
      c.line(arc.map(([x, y]) => [x, y, 5]), '#B4231F');
      c.poly([[hx, hy], ...arc], 1, 2, '#B4231F', ZONE);                            // açılım alanı
    },
  });
  LS.register({
    type: 'ev_pencere', label: 'Pencere', category: 'Ev · Yapı', icon: '⊞', solid: false,
    defaults: {w: 1200, d: 150, h: 1300, denizlik: 900, color: '#F2F4F3'},
    params: [P_W, {key: 'd', label: 'Duvar kalınlığı', type: 'number', unit: 'mm', min: 50, step: 10},
      {key: 'h', label: 'Pencere yüksekliği', type: 'number', unit: 'mm', min: 100, step: 50},
      {key: 'denizlik', label: 'Denizlik yüksekliği', type: 'number', unit: 'mm', min: 0, step: 50}, P_C],
    build(p, c) {
      const z = p.denizlik, f = 60;
      c.box(0, 0, z, p.w, p.d, f, p.color); c.box(0, 0, z + p.h - f, p.w, p.d, f, p.color);
      c.box(-p.w / 2 + f / 2, 0, z + f, f, p.d, p.h - 2 * f, p.color); c.box(p.w / 2 - f / 2, 0, z + f, f, p.d, p.h - 2 * f, p.color);
      c.box(0, 0, z + f, p.w - 2 * f, 20, p.h - 2 * f, '#9FC9E0', {opacity: .35, edges: false});
      c.box(0, -p.d / 2 - 30, z - 20, p.w + 100, 80, 20, shade(p.color, .85));
    },
  });

  /* ================= Ev · Salon ================= */
  const SOFA_P = [P_W, P_D, {key: 'h', label: 'Sırt yüksekliği', type: 'number', unit: 'mm', min: 300, step: 10},
    {key: 'oturma', label: 'Oturma yüksekliği', type: 'number', unit: 'mm', min: 250, step: 10},
    {key: 'kolcak', label: 'Kolçak', type: 'check'}, P_C];
  function sofa(p, c) {
    const {w, d, h} = p, s = Math.min(p.oturma, h - 50), aw = p.kolcak ? 160 : 0, bd = 200, base = shade(p.color, .7);
    c.box(0, 0, 0, w, d, 250, base);
    boxR(c, -w / 2 + aw, w / 2 - aw, -d / 2, d / 2 - bd, 250, s - 250, p.color);
    boxR(c, -w / 2 + aw, w / 2 - aw, d / 2 - bd, d / 2, 250, h - 250, p.color);
    if (aw) [-1, 1].forEach(k => c.box(k * (w / 2 - aw / 2), 0, 250, aw, d, Math.min(h, s + 200) - 250, shade(p.color, .9)));
    const n = Math.max(1, Math.round((w - 2 * aw) / 700));                        // minder çizgileri
    for (let i = 1; i < n; i++) { const x = -w / 2 + aw + i * (w - 2 * aw) / n; c.line([[x, -d / 2, s + 2], [x, d / 2 - bd, s + 2]]); }
  }
  LS.register({type: 'ev_kanepe', label: 'Kanepe (3\'lü)', category: 'Ev · Salon', icon: '🛋',
    defaults: {w: 2100, d: 900, h: 820, oturma: 440, kolcak: true, color: '#7A8FA6'}, params: SOFA_P, build: sofa});
  LS.register({type: 'ev_koltuk', label: 'Tekli koltuk', category: 'Ev · Salon', icon: '💺',
    defaults: {w: 850, d: 850, h: 820, oturma: 440, kolcak: true, color: '#A6877A'}, params: SOFA_P, build: sofa});
  LS.register({
    type: 'ev_kanepe_l', label: 'Köşe koltuk (L)', category: 'Ev · Salon', icon: '⌐',
    defaults: {w: 2800, d: 1700, h: 820, k: 900, oturma: 440, yon: 'sag', color: '#7A8FA6'},
    params: [P_W, P_D, {key: 'k', label: 'Oturma derinliği', type: 'number', unit: 'mm', min: 500, step: 10},
      {key: 'h', label: 'Sırt yüksekliği', type: 'number', unit: 'mm', min: 300, step: 10},
      {key: 'oturma', label: 'Oturma yüksekliği', type: 'number', unit: 'mm', min: 250, step: 10},
      {key: 'yon', label: 'Uzantı tarafı', type: 'select', options: [['sag', 'Sağ'], ['sol', 'Sol']]}, P_C],
    build(p, c) {
      const {w, d, h} = p, k = Math.min(p.k, d - 100, w - 300), s = Math.min(p.oturma, h - 50), bd = 200, aw = 160, sg = p.yon === 'sag' ? 1 : -1, base = shade(p.color, .7);
      const X = (a, b) => sg > 0 ? [a, b] : [-b, -a];                              // sağ tarafa göre yazılır, sola aynalanır
      boxR(c, -w / 2, w / 2, d / 2 - k, d / 2, 0, 250, base);                       // ana kol tabanı
      boxR(c, ...X(w / 2 - k, w / 2), -d / 2, d / 2 - k, 0, 250, base);             // uzantı tabanı
      boxR(c, ...X(-w / 2 + aw, w / 2 - bd), d / 2 - k, d / 2 - bd, 250, s - 250, p.color);
      boxR(c, ...X(w / 2 - k, w / 2 - bd), -d / 2, d / 2 - k, 250, s - 250, p.color);
      boxR(c, -w / 2, w / 2, d / 2 - bd, d / 2, 250, h - 250, p.color);             // arka sırt
      boxR(c, ...X(w / 2 - bd, w / 2), -d / 2, d / 2 - bd, 250, h - 250, p.color);  // yan sırt
      boxR(c, ...X(-w / 2, -w / 2 + aw), d / 2 - k, d / 2 - bd, 250, s - 50, shade(p.color, .9)); // kolçak
    },
  });
  LS.register({
    type: 'ev_sehpa', label: 'Orta sehpa', category: 'Ev · Salon', icon: '▭',
    defaults: {w: 1000, d: 550, h: 420, color: '#9C7B5B'}, params: [P_W, P_D, P_H, P_C],
    build(p, c) { c.table(p.w, p.d, p.h, p.color, 30, 40); },
  });
  LS.register({
    type: 'ev_tv_unitesi', label: 'TV ünitesi', category: 'Ev · Salon', icon: '📺',
    defaults: {w: 1800, d: 400, h: 500, tv: true, inc: 55, color: '#6B5847'},
    params: [P_W, P_D, P_H, {key: 'tv', label: 'TV göster', type: 'check'},
      {key: 'inc', label: 'TV boyutu', type: 'number', unit: 'inç', min: 20, max: 100, step: 1}, P_C],
    build(p, c) {
      c.box(0, 0, 0, p.w, p.d, p.h, p.color);
      front(c, p.d, [[-p.w / 6, 30], [-p.w / 6, p.h - 30]]); front(c, p.d, [[p.w / 6, 30], [p.w / 6, p.h - 30]]);
      if (p.tv) { const D = p.inc * 25.4, tw = D * .872, th = D * .49;               // 16:9
        c.box(0, 0, p.h, 300, 200, 60, '#222'); c.box(0, 0, p.h + 60, 60, 40, 100, '#222', {pick: false});
        c.box(0, 0, p.h + 140, tw, 40, th, '#1A1F1D', {pick: false}); }
    },
  });
  LS.register({
    type: 'ev_kitaplik', label: 'Kitaplık', category: 'Ev · Salon', icon: '📚',
    defaults: {w: 800, d: 300, h: 1900, kat: 5, color: '#C9A87C'},
    params: [P_W, P_D, P_H, {key: 'kat', label: 'Raf sayısı', type: 'number', min: 1, max: 12, step: 1}, P_C],
    build(p, c) {
      const t = 18;
      c.box(-p.w / 2 + t / 2, 0, 0, t, p.d, p.h, p.color); c.box(p.w / 2 - t / 2, 0, 0, t, p.d, p.h, p.color);
      c.box(0, p.d / 2 - 4, 0, p.w - 2 * t, 8, p.h, shade(p.color, .85));
      for (let i = 0; i <= p.kat; i++) c.box(0, 0, i * (p.h - t) / p.kat, p.w - 2 * t, p.d - 8, t, p.color);
    },
  });
  LS.register({
    type: 'ev_hali', label: 'Halı', category: 'Ev · Salon', icon: '▦', solid: false,
    defaults: {w: 2000, d: 1400, h: 10, color: '#C27C5A'}, params: [P_W, P_D, P_C],
    build(p, c) { c.box(0, 0, 0, p.w, p.d, 10, p.color, {opacity: .8}); },
  });
  LS.register({
    type: 'ev_bitki', label: 'Saksı bitki', category: 'Ev · Salon', icon: '🪴',
    defaults: {w: 450, d: 450, h: 1200, color: '#4E8A57'},
    params: [{key: 'w', label: 'Çap', type: 'number', unit: 'mm', min: 100, step: 10}, P_H, P_C],
    build(p, c) { const r = p.w / 2; c.cyl(0, 0, 0, r * .6, 350, '#A0674A', {rTop: r * .7}); c.sphere(0, 0, Math.max(350 + r, p.h - r), r, p.color); },
  });
  LS.register({
    type: 'ev_lambader', label: 'Lambader', category: 'Ev · Salon', icon: '💡',
    defaults: {w: 400, d: 400, h: 1650, color: '#F0E2B6'},
    params: [{key: 'w', label: 'Abajur çapı', type: 'number', unit: 'mm', min: 150, step: 10}, P_H, P_C],
    build(p, c) {
      c.cyl(0, 0, 0, 150, 20, '#3A3F3C'); c.cyl(0, 0, 20, 12, p.h - 320, '#3A3F3C');
      c.cyl(0, 0, p.h - 300, p.w / 2, 300, p.color, {rTop: p.w * .35, opacity: .9});
    },
  });

  /* ================= Ev · Yemek ve çalışma ================= */
  LS.register({
    type: 'ev_yemek_masasi', label: 'Yemek masası', category: 'Ev · Yemek', icon: '🍽',
    defaults: {w: 1600, d: 900, h: 750, sandalye: true, color: '#9C7B5B', sRenk: '#5D6B78'},
    params: [P_W, P_D, P_H, {key: 'sandalye', label: 'Sandalyeleri göster', type: 'check'}, P_C,
      {key: 'sRenk', label: 'Sandalye rengi', type: 'color'}],
    build(p, c) {
      c.table(p.w, p.d, p.h, p.color);
      if (!p.sandalye) return;
      const n = Math.max(1, Math.floor(p.w / 600));
      for (let i = 0; i < n; i++) { const x = -p.w / 2 + (i + .5) * p.w / n;
        chair(c, x, p.d / 2 + 90, 0, p.sRenk); chair(c, x, -p.d / 2 - 90, 180, p.sRenk); }
      if (p.d >= 800) { chair(c, p.w / 2 + 90, 0, 90, p.sRenk); chair(c, -p.w / 2 - 90, 0, 270, p.sRenk); }
    },
  });
  LS.register({
    type: 'ev_sandalye', label: 'Sandalye', category: 'Ev · Yemek', icon: '🪑',
    defaults: {w: 450, d: 480, h: 880, oturma: 450, color: '#5D6B78'},
    params: [P_W, P_D, P_H, {key: 'oturma', label: 'Oturma yüksekliği', type: 'number', unit: 'mm', min: 200, step: 10}, P_C],
    build(p, c) { chair(c, 0, 0, 0, p.color, p.w, p.d, p.h, p.oturma); },
  });
  LS.register({
    type: 'ev_calisma_masasi', label: 'Çalışma masası', category: 'Ev · Yemek', icon: '🖥',
    defaults: {w: 1200, d: 600, h: 750, color: '#E2DCD0'}, params: [P_W, P_D, P_H, P_C],
    build(p, c) { c.table(p.w, p.d, p.h, p.color, 25, 40); },
  });

  /* ================= Ev · Yatak odası ================= */
  LS.register({
    type: 'ev_yatak', label: 'Yatak', category: 'Ev · Yatak odası', icon: '🛏',
    defaults: {w: 1600, d: 2000, h: 500, baslik: 1000, color: '#E8EEF4', govde: '#8B7B6B'},
    params: [{key: 'w', label: 'Genişlik (X)', type: 'number', unit: 'mm', min: 700, step: 10},
      {key: 'd', label: 'Boy (Y)', type: 'number', unit: 'mm', min: 1500, step: 10},
      {key: 'h', label: 'Şilte üstü yükseklik', type: 'number', unit: 'mm', min: 200, step: 10},
      {key: 'baslik', label: 'Başlık yüksekliği', type: 'number', unit: 'mm', min: 0, step: 50},
      {key: 'color', label: 'Nevresim', type: 'color'}, {key: 'govde', label: 'Gövde', type: 'color'}],
    build(p, c) {
      const {w, d, h} = p, ht = 60;
      c.box(0, -ht / 2, 0, w, d - ht, h - 200, p.govde);
      c.box(0, -ht / 2, h - 200, w - 30, d - ht - 30, 200, '#F7F7F2');
      if (p.baslik > 0) c.box(0, d / 2 - ht / 2, 0, w + 40, ht, Math.max(p.baslik, h), p.govde);
      const np = w >= 1200 ? 2 : 1, pw = (w - 120) / np - 40;
      for (let i = 0; i < np; i++) c.box(-w / 2 + 60 + (i + .5) * (w - 120) / np, d / 2 - ht - 250, h, pw, 350, 120, '#FFFFFF', {pick: false});
      c.box(0, -d / 2 + (d - ht) * .35, h, w + 20, (d - ht) * .7, 40, p.color, {pick: false});
    },
  });
  LS.register({
    type: 'ev_komodin', label: 'Komodin', category: 'Ev · Yatak odası', icon: '▤',
    defaults: {w: 500, d: 400, h: 550, cekmece: 2, color: '#C9A87C'},
    params: [P_W, P_D, P_H, {key: 'cekmece', label: 'Çekmece', type: 'number', min: 1, max: 6, step: 1}, P_C],
    build(p, c) {
      c.box(0, 0, 0, p.w, p.d, p.h, p.color);
      for (let i = 1; i < p.cekmece; i++) { const z = i * p.h / p.cekmece; front(c, p.d, [[-p.w / 2 + 20, z], [p.w / 2 - 20, z]]); }
    },
  });
  LS.register({
    type: 'ev_gardirop', label: 'Gardırop', category: 'Ev · Yatak odası', icon: '🚪',
    defaults: {w: 1800, d: 600, h: 2200, kapak: 3, surgulu: false, acilim: true, color: '#E4DDD2'},
    params: [P_W, P_D, P_H, {key: 'kapak', label: 'Kapak sayısı', type: 'number', min: 1, max: 8, step: 1},
      {key: 'surgulu', label: 'Sürgülü kapak', type: 'check'}, {key: 'acilim', label: 'Kapak açılım alanı', type: 'check'}, P_C],
    build(p, c) {
      const {w, d, h} = p, n = Math.max(1, Math.round(p.kapak)), kw = w / n;
      c.box(0, 0, 0, w, d, h, p.color);
      for (let i = 1; i < n; i++) front(c, d, [[-w / 2 + i * kw, 60], [-w / 2 + i * kw, h - 30]]);
      if (p.acilim && !p.surgulu) c.box(0, -d / 2 - kw / 2, 0, w, kw, 3, '#2E6FD8', ZONE);
    },
  });

  /* ================= Ev · Mutfak ================= */
  LS.register({
    type: 'ev_mutfak_tezgah', label: 'Mutfak dolabı + tezgah', category: 'Ev · Mutfak', icon: '▬',
    defaults: {w: 2400, d: 600, h: 900, modul: 600, ust: true, ustD: 350, ustH: 700, ustZ: 1450, color: '#E9E6DF', tezgah: '#5F5A55'},
    params: [P_W, {key: 'd', label: 'Tezgah derinliği', type: 'number', unit: 'mm', min: 300, step: 10},
      {key: 'h', label: 'Tezgah yüksekliği', type: 'number', unit: 'mm', min: 500, step: 10},
      {key: 'modul', label: 'Kapak genişliği', type: 'number', unit: 'mm', min: 200, step: 50},
      {key: 'ust', label: 'Üst dolap', type: 'check'},
      {key: 'ustD', label: 'Üst dolap derinliği', type: 'number', unit: 'mm', min: 200, step: 10},
      {key: 'ustH', label: 'Üst dolap yüksekliği', type: 'number', unit: 'mm', min: 200, step: 10},
      {key: 'ustZ', label: 'Üst dolap alt kotu', type: 'number', unit: 'mm', min: 0, step: 10},
      {key: 'color', label: 'Dolap rengi', type: 'color'}, {key: 'tezgah', label: 'Tezgah rengi', type: 'color'}],
    build(p, c) {
      const {w, d, h} = p, tz = 40, baza = 100;
      c.box(0, 25, 0, w, d - 70, baza, '#3A3F3C');
      c.box(0, 10, baza, w, d - 20, h - tz - baza, p.color);
      c.box(0, 0, h - tz, w, d, tz, p.tezgah);
      const n = Math.max(1, Math.round(w / p.modul));
      for (let i = 1; i < n; i++) { const x = -w / 2 + i * w / n; c.line([[x, -d / 2 + 18, baza + 10], [x, -d / 2 + 18, h - tz - 10]]); }
      if (p.ust) { c.box(0, d / 2 - p.ustD / 2, p.ustZ, w, p.ustD, p.ustH, p.color);
        for (let i = 1; i < n; i++) { const x = -w / 2 + i * w / n; c.line([[x, d / 2 - p.ustD - 2, p.ustZ + 10], [x, d / 2 - p.ustD - 2, p.ustZ + p.ustH - 10]]); } }
    },
  });
  LS.register({
    type: 'ev_buzdolabi', label: 'Buzdolabı', category: 'Ev · Mutfak', icon: '🧊',
    defaults: {w: 700, d: 700, h: 1850, color: '#D9DEE2'}, params: [P_W, P_D, P_H, P_C],
    build(p, c) {
      c.box(0, 0, 0, p.w, p.d, p.h, p.color, {metalness: .3});
      front(c, p.d, [[-p.w / 2 + 10, p.h * .65], [p.w / 2 - 10, p.h * .65]]);
      c.box(p.w / 2 - 60, -p.d / 2 - 20, p.h * .7, 20, 30, 300, '#6E7477', {pick: false});
      c.box(p.w / 2 - 60, -p.d / 2 - 20, p.h * .4, 20, 30, 300, '#6E7477', {pick: false});
    },
  });
  LS.register({
    type: 'ev_ocak', label: 'Fırınlı ocak', category: 'Ev · Mutfak', icon: '♨',
    defaults: {w: 600, d: 600, h: 900, color: '#C9CDD0'}, params: [P_W, P_D, P_H, P_C],
    build(p, c) {
      c.box(0, 0, 0, p.w, p.d, p.h - 20, p.color, {metalness: .3}); c.box(0, 0, p.h - 20, p.w, p.d, 20, '#222');
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([i, j]) => c.cyl(i * p.w / 4, j * p.d / 4, p.h, Math.min(p.w, p.d) / 7, 8, '#555', {pick: false}));
      front(c, p.d, [[-p.w / 2 + 60, 120], [p.w / 2 - 60, 120], [p.w / 2 - 60, p.h - 200], [-p.w / 2 + 60, p.h - 200], [-p.w / 2 + 60, 120]]);
    },
  });
  LS.register({
    type: 'ev_bulasik', label: 'Bulaşık makinesi', category: 'Ev · Mutfak', icon: '◫',
    defaults: {w: 600, d: 600, h: 850, color: '#D9DEE2'}, params: [P_W, P_D, P_H, P_C],
    build(p, c) { c.box(0, 0, 0, p.w, p.d, p.h, p.color, {metalness: .3}); front(c, p.d, [[-p.w / 2 + 10, p.h - 100], [p.w / 2 - 10, p.h - 100]]); },
  });
  LS.register({
    type: 'ev_camasir', label: 'Çamaşır makinesi', category: 'Ev · Mutfak', icon: '◎',
    defaults: {w: 600, d: 600, h: 850, color: '#F2F4F5'}, params: [P_W, P_D, P_H, P_C],
    build(p, c) { c.box(0, 0, 0, p.w, p.d, p.h, p.color); circleFront(c, p.d, 0, p.h * .45, p.w * .3, '#3A3F3C'); front(c, p.d, [[-p.w / 2 + 10, p.h - 120], [p.w / 2 - 10, p.h - 120]]); },
  });

  /* ================= Ev · Banyo ================= */
  LS.register({
    type: 'ev_lavabo', label: 'Lavabo dolabı', category: 'Ev · Banyo', icon: '◡',
    defaults: {w: 600, d: 450, h: 850, color: '#E9E6DF'}, params: [P_W, P_D, P_H, P_C],
    build(p, c) {
      c.box(0, 0, 0, p.w, p.d, p.h - 20, p.color); c.box(0, 0, p.h - 20, p.w, p.d, 20, '#FFFFFF');
      c.cyl(0, -20, p.h, Math.min(p.w, p.d) * .35, 4, '#C9DCE6', {pick: false});
      c.cyl(0, p.d / 2 - 60, p.h, 18, 200, '#9AA3A8', {pick: false});
    },
  });
  LS.register({
    type: 'ev_klozet', label: 'Klozet', category: 'Ev · Banyo', icon: '🚽',
    defaults: {w: 380, d: 650, h: 420, rezervuar: 800, color: '#FFFFFF'},
    params: [P_W, P_D, {key: 'h', label: 'Oturma yüksekliği', type: 'number', unit: 'mm', min: 200, step: 10},
      {key: 'rezervuar', label: 'Rezervuar üstü', type: 'number', unit: 'mm', min: 0, step: 10}, P_C],
    build(p, c) {
      const td = 180, bl = p.d - td;
      if (p.rezervuar > 0) c.box(0, p.d / 2 - td / 2, 0, p.w, td, p.rezervuar, p.color);
      const m = c.cyl(0, p.d / 2 - td - bl / 2, 0, p.w / 2, p.h, p.color, {edges: false}); m.scale.z = bl / p.w;
    },
  });
  LS.register({
    type: 'ev_dus', label: 'Duş teknesi', category: 'Ev · Banyo', icon: '🚿',
    defaults: {w: 900, d: 900, h: 2000, kabin: true, color: '#FFFFFF'},
    params: [P_W, P_D, {key: 'h', label: 'Kabin yüksekliği', type: 'number', unit: 'mm', min: 100, step: 50},
      {key: 'kabin', label: 'Cam kabin', type: 'check'}, P_C],
    build(p, c) {
      c.box(0, 0, 0, p.w, p.d, 60, p.color); c.cyl(0, 0, 60, 40, 2, '#9AA3A8', {pick: false});
      if (p.kabin) { const g = {opacity: .25, edges: false};
        c.box(0, -p.d / 2 + 4, 60, p.w, 8, p.h - 60, '#9FC9E0', g); c.box(-p.w / 2 + 4, 0, 60, 8, p.d, p.h - 60, '#9FC9E0', g); }
    },
  });
  LS.register({
    type: 'ev_kuvet', label: 'Küvet', category: 'Ev · Banyo', icon: '🛁',
    defaults: {w: 1700, d: 750, h: 560, color: '#FFFFFF'}, params: [P_W, P_D, P_H, P_C],
    build(p, c) { c.box(0, 0, 0, p.w, p.d, p.h, p.color); c.box(0, 0, p.h, p.w - 140, p.d - 140, 2, '#C9DCE6', {pick: false, edges: false}); },
  });
})();
