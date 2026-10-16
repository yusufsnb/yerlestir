/* Yerleşim Stüdyosu – uygulama
 * Sahne, etkileşim (seç, sürükle, döndür, sil, çoğalt), özellik paneli,
 * geri al / yinele, JSON kaydet / aç, otomatik kayıt, ölçü aracı (köşe/kenar yakalama),
 * iki nesne arası boşluk, çakışma kontrolü.
 * Nesne tipleri src/objects.js içinde tanımlanır; bu dosyayı değiştirmeden yeni nesne eklenebilir.
 */
(() => {
  'use strict';
  const S = LS.S, APP = 'yerlesim-studyosu', VERSION = 1, STORE = APP + ':otomatik-kayit';
  const $ = id => document.getElementById(id);

  // ---------------- Durum ----------------
  let STATE = {app: APP, version: VERSION, name: 'Yeni yerleşim', area: {w: 6000, d: 4000}, objects: []};
  const OBJ = new Map();                 // id -> {o, g, pick[], labels[]}
  let sel = new Set();
  const opt = {snap: 100, rotStep: 90, labels: true, collide: true, tool: 'select'};
  const hist = {list: [], idx: -1};

  // ---------------- Sahne ----------------
  const stage = $('stage');
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  const lr = new THREE.CSS2DRenderer(); lr.domElement.className = 'labels'; stage.appendChild(lr.domElement);
  const scene = new THREE.Scene();
  const persp = new THREE.PerspectiveCamera(40, 1, .05, 500);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, .05, 500);
  let camera = ortho;
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - .02; controls.screenSpacePanning = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xC9DBD0, .95));
  const sun = new THREE.DirectionalLight(0xffffff, .55); sun.position.set(-6, 14, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); scene.add(sun);
  const V = (x, y, z = 0) => new THREE.Vector3(x * S, z * S, -y * S);
  const toMM = v => [v.x / S, -v.z / S];

  // Zemin, ızgara, cetvel
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const env = new THREE.Group(); scene.add(env);
  const rulers = new THREE.Group(); scene.add(rulers);
  function buildEnv() {
    env.clear(); rulers.children.slice().forEach(o => { if (o.element) o.element.remove(); rulers.remove(o); });
    const {w, d} = STATE.area, m = 2000;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry((w + 2 * m + 20000) * S, (d + 2 * m + 20000) * S), new THREE.MeshStandardMaterial({color: cssVar('--floor-out')}));
    fl.rotation.x = -Math.PI / 2; fl.position.copy(V(w / 2, d / 2, -2)); fl.receiveShadow = true; env.add(fl);
    const ar = new THREE.Mesh(new THREE.PlaneGeometry(w * S, d * S), new THREE.MeshStandardMaterial({color: cssVar('--floor')}));
    ar.rotation.x = -Math.PI / 2; ar.position.copy(V(w / 2, d / 2, 0)); ar.receiveShadow = true; env.add(ar);
    const minor = new THREE.LineBasicMaterial({color: cssVar('--grid-minor')}), major = new THREE.LineBasicMaterial({color: cssVar('--grid-major')});
    const st = opt.snap >= 100 ? opt.snap : 100, pts = [], ptsM = [];
    for (let x = -m; x <= w + m; x += st) (x % 1000 === 0 ? ptsM : pts).push(V(x, -m, 1), V(x, d + m, 1));
    for (let y = -m; y <= d + m; y += st) (y % 1000 === 0 ? ptsM : pts).push(V(-m, y, 1), V(w + m, y, 1));
    env.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), minor));
    env.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ptsM), major));
    const bl = [V(0, 0, 3), V(w, 0, 3), V(w, d, 3), V(0, d, 3), V(0, 0, 3)];
    env.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bl), new THREE.LineBasicMaterial({color: cssVar('--accent')})));
    const tick = (txt, p) => { const e = document.createElement('div'); e.className = 'ruler'; e.textContent = txt; const o = new THREE.CSS2DObject(e); o.position.copy(p); rulers.add(o); };
    for (let x = 0; x <= w; x += 1000) tick(x, V(x, -280));
    for (let y = 0; y <= d; y += 1000) tick(y, V(-380, y));
    tick(`${w} × ${d} mm`, V(w / 2, d + 350));
    const sz = Math.max(w, d) * S;
    Object.assign(sun.shadow.camera, {left: -sz, right: sz, top: sz, bottom: -sz}); sun.shadow.camera.updateProjectionMatrix();
    sun.position.copy(V(w / 2 - 4000, d / 2 + 3000, 12000)); sun.target.position.copy(V(w / 2, d / 2)); scene.add(sun.target);
  }
  function cssVar(n) { return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#ffffff'); }

  // ---------------- Nesneler ----------------
  const uid = () => 'o' + Math.random().toString(36).slice(2, 8);
  const defOf = o => LS.types[o.type];
  const paramsOf = o => Object.assign({}, (defOf(o) || {defaults: {}}).defaults, o.params);

  function buildObj(o) {
    removeObj(o.id, true); snapCache = null;
    const g = new THREE.Group(), pick = [], labels = [];
    const ctx = LS.makeCtx(g, pick, labels), def = defOf(o);
    try {
      if (!def) throw new Error('Tanımsız tip: ' + o.type);
      def.build(paramsOf(o), ctx);
    } catch (e) {
      console.error(e); g.clear(); pick.length = 0;
      const p = paramsOf(o); ctx.box(0, 0, 0, p.w || 500, p.d || 500, p.h || 500, '#B4231F', {opacity: .6});
      ctx.text('⚠ ' + (def ? 'çizim hatası' : 'tanımsız tip: ' + o.type), 0, 0, (p.h || 500) + 100, 'obj-err');
    }
    const name = document.createElement('div'); name.className = 'obj-name'; name.textContent = o.name;
    const nl = new THREE.CSS2DObject(name); g.add(nl); labels.push(nl);
    const bb = new THREE.Box3().setFromObject(g); nl.position.set(0, (bb.isEmpty() ? .5 : bb.max.y) + .15, 0);
    pick.forEach(m => m.userData.oid = o.id);
    g.position.copy(V(o.x, o.y)); g.rotation.y = -(o.rot || 0) * Math.PI / 180;
    scene.add(g); OBJ.set(o.id, {o, g, pick, labels, name: nl, hideName: o.type === 'olcu'});   // ölçüde mm etiketi yeterli
    showLabels();
  }
  function removeObj(id, keepState) {
    const r = OBJ.get(id); if (!r) return;
    r.labels.forEach(l => l.element.remove()); scene.remove(r.g); OBJ.delete(id); snapCache = null;
    r.g.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); });
    if (!keepState) STATE.objects = STATE.objects.filter(o => o.id !== id);
  }
  function addObj(type, x, y, extra = {}) {
    const def = LS.types[type]; if (!def) return null;
    const o = Object.assign({id: uid(), type, name: def.label, x: snapV(x), y: snapV(y), rot: 0, locked: false, params: {}}, extra);
    STATE.objects.push(o); buildObj(o); return o;
  }
  function loadState(s, keepHistory) {
    [...OBJ.keys()].forEach(id => removeObj(id, true));
    STATE = Object.assign({app: APP, version: VERSION, name: 'Yerleşim', area: {w: 6000, d: 4000}, objects: []}, s);
    STATE.objects = (STATE.objects || []).map(o => Object.assign({rot: 0, locked: false, params: {}}, o));
    buildEnv(); STATE.objects.forEach(buildObj);
    sel = new Set([...sel].filter(id => OBJ.has(id)));
    $('docName').value = STATE.name; $('areaW').value = STATE.area.w; $('areaD').value = STATE.area.d;
    if (!keepHistory) { hist.list = [JSON.stringify(STATE)]; hist.idx = 0; }
    refreshSel(); checkCollisions(); status();
  }

  // ---------------- Geçmiş ve kayıt ----------------
  function commit() {
    const j = JSON.stringify(STATE);
    if (hist.list[hist.idx] === j) return;
    hist.list = hist.list.slice(0, hist.idx + 1); hist.list.push(j); if (hist.list.length > 150) hist.list.shift();
    hist.idx = hist.list.length - 1;
    try { localStorage.setItem(STORE, j); $('saveState').textContent = 'Otomatik kaydedildi'; } catch (e) { $('saveState').textContent = 'Otomatik kayıt yok (tarayıcı izni)'; }
    checkCollisions(); status();
  }
  function undo() { if (hist.idx > 0) { hist.idx--; loadState(JSON.parse(hist.list[hist.idx]), true); saveLocal(); } }
  function redo() { if (hist.idx < hist.list.length - 1) { hist.idx++; loadState(JSON.parse(hist.list[hist.idx]), true); saveLocal(); } }
  function saveLocal() { try { localStorage.setItem(STORE, JSON.stringify(STATE)); } catch (e) {} }

  // ---------------- Yardımcılar ----------------
  const snapV = v => opt.snap > 1 ? Math.round(v / opt.snap) * opt.snap : Math.round(v);
  const mouse = new THREE.Vector2(), ray = new THREE.Raycaster();
  function setRay(ev) { const r = renderer.domElement.getBoundingClientRect(); mouse.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mouse, camera); }
  function floorAt(ev) { setRay(ev); const v = new THREE.Vector3(); return ray.ray.intersectPlane(floorPlane, v) ? toMM(v) : null; }
  function pickAt(ev) {
    setRay(ev); const list = []; OBJ.forEach(r => list.push(...r.pick));
    const hits = ray.intersectObjects(list, false); if (!hits.length) return null;
    const solid = hits.find(h => { const r = OBJ.get(h.object.userData.oid); return r && defOf(r.o) && defOf(r.o).solid; });
    return (solid || hits[0]).object.userData.oid;
  }
  function footprint(id) { const r = OBJ.get(id); const b = new THREE.Box3(); r.pick.forEach(m => b.expandByObject(m)); return b; }

  // ---------------- Seçim ----------------
  const helpers = new Map(), warnBoxes = new Map();
  function refreshSel() {
    helpers.forEach(h => scene.remove(h)); helpers.clear();
    sel.forEach(id => { const r = OBJ.get(id); if (!r) return;
      const h = new THREE.BoxHelper(r.g, cssVar('--sel')); h.material.depthTest = false; h.renderOrder = 20; scene.add(h); helpers.set(id, h); });
    inspector(); status();
  }
  const updateHelpers = () => helpers.forEach((h, id) => OBJ.get(id) && h.update(OBJ.get(id).g));

  // Çakışma kontrolü (ayak izi kutuları)
  function checkCollisions() {
    warnBoxes.forEach(h => scene.remove(h)); warnBoxes.clear();
    if (!opt.collide) { $('collideInfo').textContent = ''; return; }
    const ids = [...OBJ.keys()].filter(id => { const d = defOf(OBJ.get(id).o); return d && d.solid; });
    const bx = ids.map(id => { const b = footprint(id); b.expandByScalar(-0.002); return b; }), hit = new Set();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
      if (!bx[i].isEmpty() && !bx[j].isEmpty() && bx[i].intersectsBox(bx[j])) { hit.add(ids[i]); hit.add(ids[j]); }
    hit.forEach(id => { const h = new THREE.Box3Helper(footprint(id), cssVar('--warn')); scene.add(h); warnBoxes.set(id, h); });
    $('collideInfo').textContent = hit.size ? `⚠ ${hit.size} nesne çakışıyor` : '';
  }

  // ---------------- Dönüşüm işlemleri ----------------
  const selObjs = () => [...sel].map(id => OBJ.get(id)).filter(Boolean).map(r => r.o);
  function place(o) { snapCache = null; const r = OBJ.get(o.id); r.g.position.copy(V(o.x, o.y)); r.g.rotation.y = -(o.rot || 0) * Math.PI / 180; }
  function rotateSel(deg) {
    const os = selObjs().filter(o => !o.locked); if (!os.length) return;
    const px = os.reduce((s, o) => s + o.x, 0) / os.length, py = os.reduce((s, o) => s + o.y, 0) / os.length;
    const a = -deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    os.forEach(o => { const dx = o.x - px, dy = o.y - py;
      if (os.length > 1) { o.x = Math.round(px + dx * ca - dy * sa); o.y = Math.round(py + dx * sa + dy * ca); }
      o.rot = (((o.rot || 0) + deg) % 360 + 360) % 360; place(o); });
    updateHelpers(); commit(); inspector();
  }
  function nudge(dx, dy) { selObjs().filter(o => !o.locked).forEach(o => { o.x += dx; o.y += dy; place(o); }); updateHelpers(); commit(); inspector(); }
  function deleteSel() { if (!sel.size) return; sel.forEach(id => removeObj(id)); sel.clear(); refreshSel(); commit(); }
  function duplicateSel() {
    const add = selObjs().map(o => { const c = JSON.parse(JSON.stringify(o)); c.id = uid(); c.x += Math.max(opt.snap, 100) * 2; c.y -= Math.max(opt.snap, 100) * 2; c.locked = false; STATE.objects.push(c); buildObj(c); return c.id; });
    if (add.length) { sel = new Set(add); refreshSel(); commit(); }
  }
  function align(mode) {
    const os = selObjs(); if (os.length < 2) return;
    const fps = os.map(o => { const b = footprint(o.id); return {o, x0: b.min.x / S, x1: b.max.x / S, y0: -b.max.z / S, y1: -b.min.z / S}; });
    const ref = {l: Math.min(...fps.map(f => f.x0)), r: Math.max(...fps.map(f => f.x1)), b: Math.min(...fps.map(f => f.y0)), t: Math.max(...fps.map(f => f.y1))};
    fps.forEach(f => { if (f.o.locked) return;
      if (mode === 'l') f.o.x += ref.l - f.x0; if (mode === 'r') f.o.x += ref.r - f.x1;
      if (mode === 'b') f.o.y += ref.b - f.y0; if (mode === 't') f.o.y += ref.t - f.y1;
      f.o.x = Math.round(f.o.x); f.o.y = Math.round(f.o.y); place(f.o); });
    updateHelpers(); commit(); inspector();
  }

  // ---------------- Görünüm ----------------
  let viewMode = 'plan';
  function fit() {
    const {w, d} = STATE.area, r = stage.getBoundingClientRect(), a = r.width / Math.max(1, r.height);
    const hh = Math.max(d / 2 + 900, (w / 2 + 900) / a) * S;
    ortho.left = -hh * a; ortho.right = hh * a; ortho.top = hh; ortho.bottom = -hh; ortho.zoom = 1; ortho.updateProjectionMatrix();
    persp.aspect = a; persp.updateProjectionMatrix();
  }
  function setView(mode) {
    viewMode = mode; const {w, d} = STATE.area, c = V(w / 2, d / 2);
    camera = mode === 'plan' ? ortho : persp; controls.object = camera; fit();
    if (mode === 'plan') { camera.position.set(c.x, 50, c.z + .0001); controls.enableRotate = false; controls.mouseButtons.LEFT = THREE.MOUSE.PAN; controls.touches.ONE = THREE.TOUCH.PAN; }
    else { const s = Math.max(w, d) * S; camera.position.set(c.x + s * .75, s * .95, c.z + s * 1.15); controls.enableRotate = true; controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE; controls.touches.ONE = THREE.TOUCH.ROTATE; }
    controls.target.copy(c); controls.update(); sun.castShadow = mode !== 'plan';
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === mode));
  }
  function showLabels() { OBJ.forEach(r => { const on = opt.labels && !r.hideName; r.name.visible = on; r.name.element.style.display = on ? '' : 'none'; }); }
  function resize() { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height); lr.setSize(r.width, r.height); fit(); }

  // ---------------- Fare / dokunma ----------------
  let drag = null, measure = null;
  const mLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({color: 0xB4231F, dashSize: .05, gapSize: .03, depthTest: false}));
  mLine.visible = false; mLine.renderOrder = 30; scene.add(mLine);
  const mTagEl = document.createElement('div'); mTagEl.className = 'obj-dim'; const mTag = new THREE.CSS2DObject(mTagEl); mTag.visible = false; scene.add(mTag);
  const snapEl = document.createElement('div'); snapEl.className = 'snap-mark'; const snapMark = new THREE.CSS2DObject(snapEl); snapMark.visible = false; snapEl.style.display = 'none'; scene.add(snapMark);

  // ---------------- Ölçü aracı: köşe / kenar / merkez yakalama ----------------
  // Aday noktalar her seçilebilir parçanın plan kutusundan (köşe, kenar ortası, merkez) ve alan sınırından gelir.
  // Ctrl basılıyken yakalama kapalıdır (ızgara adımı da uygulanmaz). Shift: yatay / dikey kilit.
  const NO_SNAP = new Set(['olcu']);
  let snapCache = null;
  function buildSnapCache() {
    const pts = [], segs = [], b = new THREE.Box3(), v = new THREE.Vector3();
    OBJ.forEach(r => {
      if (NO_SNAP.has(r.o.type)) return;
      r.g.updateMatrixWorld(true);
      const W = (x, z) => { v.set(x, 0, z); r.g.localToWorld(v); return toMM(v); };
      pts.push([r.o.x, r.o.y, 'merkez']);
      r.pick.forEach(m => {
        const g = m.geometry; if (!g) return; if (!g.boundingBox) g.computeBoundingBox();
        m.updateMatrix(); b.copy(g.boundingBox).applyMatrix4(m.matrix);
        const {min, max} = b, cx = (min.x + max.x) / 2, cz = (min.z + max.z) / 2;
        if (/Cylinder|Sphere/.test(g.type)) {
          pts.push([...W(cx, cz), 'merkez']); [[min.x, cz], [max.x, cz], [cx, min.z], [cx, max.z]].forEach(([x, z]) => pts.push([...W(x, z), 'çeper'])); return; }
        const c = [[min.x, min.z], [max.x, min.z], [max.x, max.z], [min.x, max.z]].map(([x, z]) => W(x, z));
        c.forEach(q => pts.push([...q, 'köşe']));
        for (let i = 0; i < 4; i++) { const a = c[i], e = c[(i + 1) % 4]; pts.push([(a[0] + e[0]) / 2, (a[1] + e[1]) / 2, 'kenar ortası']); segs.push([a, e]); }
      });
    });
    const {w, d} = STATE.area, ac = [[0, 0], [w, 0], [w, d], [0, d]];
    ac.forEach(q => pts.push([q[0], q[1], 'alan köşesi'])); for (let i = 0; i < 4; i++) segs.push([ac[i], ac[(i + 1) % 4]]);
    snapCache = {pts, segs};
  }
  function toScreen(x, y) { const v = V(x, y).project(camera), r = renderer.domElement.getBoundingClientRect(); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height]; }
  function snapPoint(ev, p) {
    if (ev.ctrlKey) return {q: [Math.round(p[0]), Math.round(p[1])], kind: ''};
    if (!snapCache) buildSnapCache();
    const r = renderer.domElement.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = null, bd = 12;                                     // nokta yakalama: 12 px
    snapCache.pts.forEach(t => { const s = toScreen(t[0], t[1]), dd = Math.hypot(s[0] - mx, s[1] - my); if (dd < bd) { bd = dd; best = t; } });
    if (best) return {q: [Math.round(best[0]), Math.round(best[1])], kind: best[2]};
    let be = null; bd = 8;                                        // kenar yakalama: 8 px
    snapCache.segs.forEach(([a, e]) => {
      const dx = e[0] - a[0], dy = e[1] - a[1], L2 = dx * dx + dy * dy; if (L2 < 1) return;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)), c = [a[0] + t * dx, a[1] + t * dy];
      const s = toScreen(c[0], c[1]), dd = Math.hypot(s[0] - mx, s[1] - my); if (dd < bd) { bd = dd; be = c; } });
    if (be) return {q: [Math.round(be[0]), Math.round(be[1])], kind: 'kenar'};
    return {q: [snapV(p[0]), snapV(p[1])], kind: ''};
  }
  function measurePoint(ev, p) {
    let {q, kind} = snapPoint(ev, p);
    if (measure && ev.shiftKey) { const a = measure.a; if (Math.abs(q[0] - a[0]) >= Math.abs(q[1] - a[1])) q = [q[0], a[1]]; else q = [a[0], q[1]]; kind = kind ? kind + ' · kilitli' : 'kilitli'; }
    snapMark.visible = !!kind; snapEl.style.display = kind ? '' : 'none'; snapEl.dataset.kind = kind.split(' ')[0];
    snapMark.position.copy(V(q[0], q[1], 30));
    $('cursor').textContent = `X ${q[0]} · Y ${q[1]} mm${kind ? ' · ' + kind : ''}`;
    return q;
  }
  function showMeasure(on) { mLine.visible = on; mTag.visible = on; mTagEl.style.display = on ? '' : 'none'; }
  function updateMeasure(q) {
    const a = measure.a, dx = q[0] - a[0], dy = q[1] - a[1], L = Math.round(Math.hypot(dx, dy));
    mLine.geometry.setFromPoints([V(a[0], a[1], 20), V(q[0], q[1], 20)]); mLine.computeLineDistances();
    mTag.position.copy(V((a[0] + q[0]) / 2, (a[1] + q[1]) / 2, 80));
    mTagEl.textContent = `${L} mm` + (dx && dy ? `  (ΔX ${Math.abs(dx)} · ΔY ${Math.abs(dy)})` : '');
  }
  function cancelMeasure() { measure = null; showMeasure(false); }
  function addMeasureObj(a, q, name) {
    const L = Math.hypot(q[0] - a[0], q[1] - a[1]); if (L <= 1) return null;
    const o = addObj('olcu', (a[0] + q[0]) / 2, (a[1] + q[1]) / 2, {name, rot: -Math.atan2(q[1] - a[1], q[0] - a[0]) * 180 / Math.PI, params: {uzunluk: Math.round(L)}});
    o.x = (a[0] + q[0]) / 2; o.y = (a[1] + q[1]) / 2; place(o); sel = new Set([o.id]); refreshSel(); commit(); return o;
  }

  // ---------------- İki nesne arası boşluk ----------------
  // Dünya eksenine hizalı dış kutular kullanılır. 90° katı olmayan dönüşlerde sonuç yaklaşıktır.
  function fpMM(id) { const b = footprint(id); return {x0: b.min.x / S, x1: b.max.x / S, y0: -b.max.z / S, y1: -b.min.z / S}; }
  function gapOf(oa, ob) {
    const A = fpMM(oa.id), B = fpMM(ob.id);
    const gx = Math.max(B.x0 - A.x1, A.x0 - B.x1), gy = Math.max(B.y0 - A.y1, A.y0 - B.y1);
    const [L, R] = A.x0 <= B.x0 ? [A, B] : [B, A], [D, U] = A.y0 <= B.y0 ? [A, B] : [B, A];
    let seg = null;
    if (gx > 0 && gy <= 0) { const y = (Math.max(A.y0, B.y0) + Math.min(A.y1, B.y1)) / 2; seg = [[L.x1, y], [R.x0, y]]; }
    else if (gy > 0 && gx <= 0) { const x = (Math.max(A.x0, B.x0) + Math.min(A.x1, B.x1)) / 2; seg = [[x, D.y1], [x, U.y0]]; }
    else if (gx > 0 && gy > 0) seg = [[L.x1, L === D ? L.y1 : L.y0], [R.x0, R === D ? R.y1 : R.y0]];
    const r = v => Math.round(v);
    return {gx: r(gx), gy: r(gy), net: gx > 0 || gy > 0 ? r(Math.hypot(Math.max(gx, 0), Math.max(gy, 0))) : 0,
      cc: r(Math.hypot(oa.x - ob.x, oa.y - ob.y)), seg: seg && seg.map(q => q.map(r)),
      approx: [oa, ob].some(o => ((o.rot || 0) % 90 + 90) % 90 > .01)};
  }
  function gapHTML(oa, ob) {
    const g = gapOf(oa, ob), ax = v => v > 0 ? `<b>${v} mm</b>` : `yok (${-v} mm hizalı)`;
    return `<h3>Aralarındaki mesafe</h3><dl class="keys"><dt>X yönünde boşluk</dt><dd>${ax(g.gx)}</dd><dt>Y yönünde boşluk</dt><dd>${ax(g.gy)}</dd>
      <dt>En kısa net mesafe</dt><dd>${g.net ? `<b>${g.net} mm</b>` : '0 – çakışıyor / temas'}</dd><dt>Merkezler arası</dt><dd>${g.cc} mm</dd></dl>
      ${g.approx ? '<p class="muted">Not: Bir nesne 90° katı olmayan açıda. Dış kutu kullanıldı; değer yaklaşıktır.</p>' : ''}
      ${g.seg ? '<div class="row"><button data-gap="1">↔ Boşluğa ölçü çizgisi ekle</button></div>' : ''}`;
  }

  renderer.domElement.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    if (opt.tool === 'measure') {
      const p = floorAt(ev); if (!p) return; const q = measurePoint(ev, p);
      if (!measure) { measure = {a: q}; showMeasure(true); updateMeasure(q); }
      else { addMeasureObj(measure.a, q, 'Ölçü'); cancelMeasure(); }   // araç açık kalır: art arda ölçü alınabilir
      return;
    }
    const id = pickAt(ev);
    if (!id) { if (!ev.shiftKey) { sel.clear(); refreshSel(); } return; }
    if (ev.shiftKey) { sel.has(id) ? sel.delete(id) : sel.add(id); refreshSel(); return; }
    if (!sel.has(id)) { sel = new Set([id]); refreshSel(); }
    const p0 = floorAt(ev); if (!p0) return;
    drag = {p0, start: selObjs().map(o => [o, o.x, o.y]), moved: false};
    controls.enabled = false; renderer.domElement.setPointerCapture(ev.pointerId);
  }, true);
  renderer.domElement.addEventListener('pointermove', ev => {
    const p = floorAt(ev); if (p) $('cursor').textContent = `X ${Math.round(p[0])} · Y ${Math.round(p[1])} mm`;
    if (opt.tool === 'measure' && p) { const q = measurePoint(ev, p); if (measure) updateMeasure(q); }
    if (!drag || !p) return;
    const dx = snapV(p[0] - drag.p0[0]), dy = snapV(p[1] - drag.p0[1]);
    drag.start.forEach(([o, x, y]) => { if (o.locked) return; o.x = x + dx; o.y = y + dy; place(o); });
    drag.moved = dx !== 0 || dy !== 0; updateHelpers(); inspectorPos(); if (sel.size === 2 && drag.moved) inspector();
  });
  renderer.domElement.addEventListener('pointerup', () => { if (!drag) return; const m = drag.moved; drag = null; controls.enabled = true; if (m) { commit(); inspector(); } });

  // Kütüphaneden sürükle-bırak
  stage.addEventListener('dragover', ev => { if (ev.dataTransfer.types.includes('text/ls-type')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
  stage.addEventListener('drop', ev => {
    const type = ev.dataTransfer.getData('text/ls-type'); if (!type) return; ev.preventDefault();
    const p = floorAt(ev) || centerMM(); const o = addObj(type, p[0], p[1]); if (o) { sel = new Set([o.id]); refreshSel(); commit(); }
  });
  const centerMM = () => toMM(controls.target);

  // ---------------- Klavye ----------------
  addEventListener('keydown', ev => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || !$('dlg').hidden) return;
    const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && k.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
    else if (ctrl && k.toLowerCase() === 'y') { ev.preventDefault(); redo(); }
    else if (ctrl && k.toLowerCase() === 'd') { ev.preventDefault(); duplicateSel(); }
    else if (ctrl && k.toLowerCase() === 's') { ev.preventDefault(); download(); }
    else if (ctrl && k.toLowerCase() === 'a') { ev.preventDefault(); sel = new Set(OBJ.keys()); refreshSel(); }
    else if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); deleteSel(); }
    else if (k === 'r' || k === 'R') rotateSel(ev.shiftKey ? -opt.rotStep : opt.rotStep);
    else if (k === 'm' || k === 'M') setTool(opt.tool === 'measure' ? 'select' : 'measure');
    else if (k === '1') setView('plan'); else if (k === '2') setView('3d');
    else if (k === 'Escape') { if (measure) cancelMeasure(); else { setTool('select'); sel.clear(); refreshSel(); } }
    else { const st = ev.shiftKey ? 10 : Math.max(opt.snap, 1), m = {ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st]}[k];
      if (m && sel.size) { ev.preventDefault(); nudge(m[0], m[1]); } }
  });
  function setTool(t) { opt.tool = t; $('toolMeasure').setAttribute('aria-pressed', t === 'measure'); document.body.dataset.tool = t;
    cancelMeasure(); snapMark.visible = false; snapEl.style.display = 'none';
    if (t === 'measure') buildSnapCache();
    $('hint').textContent = t === 'measure' ? 'Ölçü: 1. ve 2. noktaya tıklayın. Köşe/kenar yakalanır · Shift: yatay/dikey · Ctrl: yakalama kapalı · Esc: iptal / çık'
      : 'Kütüphaneden sürükleyin veya tıklayın. 2 nesne seçin (Shift+tık): aradaki boşluk sağ panelde.'; }

  // ---------------- Kütüphane ----------------
  function buildLibrary() {
    const lib = $('library'), q = ($('libSearch').value || '').toLocaleLowerCase('tr'); lib.innerHTML = '';
    const cats = {};
    LS.order.map(t => LS.types[t]).filter(d => !q || (d.label + ' ' + d.category).toLocaleLowerCase('tr').includes(q)).forEach(d => (cats[d.category] = cats[d.category] || []).push(d));
    Object.entries(cats).forEach(([cat, defs]) => {
      const h = document.createElement('h3'); h.textContent = cat; lib.appendChild(h);
      const ul = document.createElement('div'); ul.className = 'lib-grid';
      defs.forEach(d => { const b = document.createElement('button'); b.className = 'lib-item'; b.draggable = true; b.title = d.label + ' — sürükleyin veya tıklayın';
        b.innerHTML = `<span class="ico" aria-hidden="true">${d.icon}</span><span>${d.label}</span>`;
        b.addEventListener('dragstart', ev => { ev.dataTransfer.setData('text/ls-type', d.type); ev.dataTransfer.effectAllowed = 'copy'; });
        b.addEventListener('click', () => { const c = centerMM(), o = addObj(d.type, c[0], c[1]); sel = new Set([o.id]); refreshSel(); commit(); });
        ul.appendChild(b); });
      lib.appendChild(ul);
    });
    if (!lib.children.length) lib.innerHTML = '<p class="muted">Sonuç yok.</p>';
  }

  // ---------------- Özellik paneli ----------------
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  function field(label, html, unit) { return `<label class="fld"><span>${label}</span><span class="ctl">${html}${unit ? `<em>${unit}</em>` : ''}</span></label>`; }
  function inspector() {
    const box = $('inspector'), os = selObjs();
    if (!os.length) { box.innerHTML = `<p class="muted">Bir nesne seçin. Shift + tıklama ile çoklu seçim yapılır.</p>
      <h3>Kısayollar</h3><dl class="keys"><dt>R / Shift+R</dt><dd>Döndür</dd><dt>Ok tuşları</dt><dd>Adım kadar kaydır (Shift: 10 mm)</dd>
      <dt>Ctrl+D</dt><dd>Çoğalt</dd><dt>Delete</dt><dd>Sil</dd><dt>Ctrl+Z / Ctrl+Y</dt><dd>Geri al / yinele</dd><dt>M</dt><dd>Ölçü aracı (köşe/kenar yakalar)</dd><dt>2 nesne seç</dt><dd>Aradaki boşluk</dd><dt>1 / 2</dt><dd>Plan / 3D</dd><dt>Ctrl+S</dt><dd>JSON kaydet</dd></dl>`; return; }
    if (os.length > 1) { box.innerHTML = `<p><b>${os.length} nesne seçili</b></p><p class="muted">Birlikte taşınır ve ortak merkez etrafında döner.</p>
      ${os.length === 2 ? gapHTML(os[0], os[1]) : '<p class="muted">Boşluk ölçümü için tam 2 nesne seçin.</p>'}
      <h3>Hizala</h3><div class="row"><button data-al="l">Sol</button><button data-al="r">Sağ</button><button data-al="b">Ön</button><button data-al="t">Arka</button></div>
      <h3>İşlem</h3><div class="row"><button data-act="rot">↻ ${opt.rotStep}°</button><button data-act="dup">Çoğalt</button><button data-act="del" class="danger">Sil</button></div>`;
      box.querySelectorAll('[data-al]').forEach(b => b.onclick = () => align(b.dataset.al)); bindActs(box);
      const gb = box.querySelector('[data-gap]'); if (gb) gb.onclick = () => { const g = gapOf(os[0], os[1]); if (g.seg) addMeasureObj(g.seg[0], g.seg[1], 'Boşluk'); };
      return; }
    const o = os[0], def = defOf(o), p = paramsOf(o);
    let h = `<p class="type">${def ? def.icon + ' ' + def.label : '⚠ ' + o.type}</p>`;
    h += field('Ad', `<input data-f="name" value="${esc(o.name)}">`);
    h += `<div class="pair">${field('X', `<input data-f="x" type="number" step="${opt.snap}" value="${Math.round(o.x)}">`, 'mm')}${field('Y', `<input data-f="y" type="number" step="${opt.snap}" value="${Math.round(o.y)}">`, 'mm')}</div>`;
    h += `<div class="pair">${field('Açı', `<input data-f="rot" type="number" step="${opt.rotStep}" value="${+(o.rot || 0).toFixed(1)}">`, '°')}${field('Kilit', `<input data-f="locked" type="checkbox" ${o.locked ? 'checked' : ''}>`)}</div>`;
    if (def) { h += '<h3>Parametreler</h3>';
      def.params.forEach(pr => { const v = p[pr.key];
        if (pr.type === 'number') h += field(pr.label, `<input data-p="${pr.key}" type="number" ${pr.min !== undefined ? `min="${pr.min}"` : ''} ${pr.max !== undefined ? `max="${pr.max}"` : ''} step="${pr.step || 1}" value="${v}">`, pr.unit);
        else if (pr.type === 'color') h += field(pr.label, `<input data-p="${pr.key}" type="color" value="${esc(v)}">`);
        else if (pr.type === 'check') h += field(pr.label, `<input data-p="${pr.key}" type="checkbox" ${v ? 'checked' : ''}>`);
        else if (pr.type === 'select') h += field(pr.label, `<select data-p="${pr.key}">${pr.options.map(([k, l]) => `<option value="${esc(k)}" ${k == v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`);
        else h += field(pr.label, `<input data-p="${pr.key}" value="${esc(v)}">`); }); }
    const b = new THREE.Box3(); OBJ.get(o.id).pick.forEach(m => b.expandByObject(m));
    if (!b.isEmpty()) h += `<p class="muted fp">Ayak izi: ${Math.round((b.max.x - b.min.x) / S)} × ${Math.round((b.max.z - b.min.z) / S)} mm · yükseklik ${Math.round(b.max.y / S)} mm</p>`;
    h += `<div class="row"><button data-act="rot">↻ ${opt.rotStep}°</button><button data-act="dup">Çoğalt</button><button data-act="del" class="danger">Sil</button></div>`;
    box.innerHTML = h;
    box.querySelectorAll('[data-f]').forEach(i => i.onchange = () => {
      const f = i.dataset.f; if (f === 'name') { o.name = i.value; buildObj(o); }
      else if (f === 'locked') o.locked = i.checked; else { o[f] = +i.value || 0; place(o); }
      updateHelpers(); refreshSel(); commit(); });
    box.querySelectorAll('[data-p]').forEach(i => i.onchange = () => {
      const pr = def.params.find(q => q.key === i.dataset.p);
      let v = pr.type === 'number' ? +i.value : pr.type === 'check' ? i.checked : i.value;
      if (pr.type === 'number') { if (pr.min !== undefined) v = Math.max(pr.min, v); if (pr.max !== undefined) v = Math.min(pr.max, v); }
      o.params[pr.key] = v; buildObj(o); refreshSel(); commit(); });
    bindActs(box);
  }
  function inspectorPos() { const os = selObjs(); if (os.length !== 1) return; const x = document.querySelector('[data-f="x"]'), y = document.querySelector('[data-f="y"]'); if (x) x.value = Math.round(os[0].x); if (y) y.value = Math.round(os[0].y); }
  function bindActs(box) { box.querySelectorAll('[data-act]').forEach(b => b.onclick = () => ({rot: () => rotateSel(opt.rotStep), dup: duplicateSel, del: deleteSel})[b.dataset.act]()); }
  function status() { $('stats').textContent = `${STATE.objects.length} nesne · ${sel.size} seçili`; $('undo').disabled = hist.idx <= 0; $('redo').disabled = hist.idx >= hist.list.length - 1; }

  // ---------------- Dosya ----------------
  function download() {
    const name = (STATE.name || 'yerlesim').replace(/[^\p{L}\p{N}_-]+/gu, '_');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(STATE, null, 1)], {type: 'application/json'}));
    a.download = name + '.json'; document.body.appendChild(a); a.click(); a.remove();
  }
  function png() { renderer.render(scene, camera); const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = (STATE.name || 'yerlesim') + '.png'; a.click(); }
  function openJSON(text) {
    let s; try { s = JSON.parse(text); } catch (e) { alert('JSON okunamadı: ' + e.message); return; }
    if (!Array.isArray(s.objects)) { alert('Bu dosya bir Yerleşim Stüdyosu dosyası değil (objects listesi yok).'); return; }
    const unknown = [...new Set(s.objects.map(o => o.type).filter(t => !LS.types[t]))];
    if (unknown.length) alert('Tanımsız nesne tipleri kırmızı kutu olarak gösterilecek: ' + unknown.join(', '));
    sel.clear(); loadState(s); saveLocal(); setView(viewMode);
  }

  // ---------------- Arayüz bağlantıları ----------------
  $('libSearch').oninput = buildLibrary;
  $('undo').onclick = undo; $('redo').onclick = redo;
  $('save').onclick = download; $('png').onclick = png;
  $('open').onclick = () => $('file').click();
  $('file').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(openJSON); e.target.value = ''; };
  $('newDoc').onclick = () => { if (STATE.objects.length && !confirm('Mevcut yerleşim temizlensin mi? (Önce kaydetmek isteyebilirsiniz.)')) return; sel.clear(); loadState({name: 'Yeni yerleşim', area: STATE.area, objects: []}); saveLocal(); };
  $('showJSON').onclick = () => { $('dlgText').value = JSON.stringify(STATE, null, 1); $('dlg').hidden = false; $('dlgText').focus(); $('dlgText').select(); };
  $('dlgClose').onclick = () => $('dlg').hidden = true;
  $('dlgApply').onclick = () => { $('dlg').hidden = true; openJSON($('dlgText').value); };
  $('dlgCopy').onclick = async () => { $('dlgText').select(); try { await navigator.clipboard.writeText($('dlgText').value); } catch (e) { document.execCommand('copy'); } $('dlgCopy').textContent = 'Kopyalandı'; setTimeout(() => $('dlgCopy').textContent = 'Kopyala', 1500); };
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('snap').onchange = e => { opt.snap = +e.target.value; buildEnv(); };
  $('rotStep').onchange = e => { opt.rotStep = +e.target.value; inspector(); };
  $('toggleLabels').onchange = e => { opt.labels = e.target.checked; showLabels(); };
  $('toggleCollide').onchange = e => { opt.collide = e.target.checked; checkCollisions(); };
  $('toolMeasure').onclick = () => setTool(opt.tool === 'measure' ? 'select' : 'measure');
  $('docName').onchange = e => { STATE.name = e.target.value; commit(); };
  ['areaW', 'areaD'].forEach(id => $(id).onchange = () => { STATE.area = {w: Math.max(500, +$('areaW').value || 6000), d: Math.max(500, +$('areaD').value || 4000)}; buildEnv(); setView(viewMode); commit(); });
  new ResizeObserver(resize).observe(stage);

  // ---------------- Başlat ----------------
  buildLibrary(); resize();
  let start = null; try { start = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) {}
  loadState(start && Array.isArray(start.objects) ? start : STATE); setView('plan'); setTool('select');
  if (start) $('saveState').textContent = 'Son çalışma yüklendi';
  const clock = new THREE.Clock();
  (function loop() { clock.getDelta(); controls.update(); renderer.render(scene, camera); lr.render(scene, camera); requestAnimationFrame(loop); })();

  // Konsoldan erişim (hata ayıklama ve eklenti yazarken)
  window.Studio = {get state() { return STATE; }, addObj, loadState: s => { loadState(s); saveLocal(); }, select: ids => { sel = new Set(ids); refreshSel(); }, setView, scene, get camera() { return camera; }};
})();
