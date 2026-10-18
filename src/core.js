/* Yerleşim Stüdyosu – çekirdek
 * Nesne kayıt sistemi ve çizim yardımcıları.
 * Yeni nesne eklemek için src/objects.js dosyasında LS.register({...}) çağırın.
 *
 * Birim: mm. Yerel koordinat: X sağa, Y arkaya (planda yukarı), Z yukarı.
 * build() içinde çizilen her şey nesnenin MERKEZİNE (0,0) göredir.
 */
window.LS = (() => {
  const S = 0.001;                 // mm -> sahne birimi (m)
  const types = {};                // kayıtlı nesne tipleri
  const order = [];                // kütüphanedeki sıra

  /**
   * Nesne tipi kaydet.
   * def = {
   *   type: 'benzersiz-anahtar',          // JSON'a yazılır, sonradan DEĞİŞTİRMEYİN
   *   label: 'Görünen ad', category: 'Kategori', icon: '▭',
   *   group: 'Endüstriyel',               // isteğe bağlı ana başlık; "Ev · Salon" gibi kategoriden de çıkarılır
   *   solid: true,                        // false: çakışma kontrolüne girmez (zemin alanı, ölçü...)
   *   defaults: { w: 1000, d: 500, h: 900, color: '#1E7A4C', ... },
   *   params: [ { key: 'w', label: 'Genişlik', type: 'number', unit: 'mm', min: 10, step: 10 }, ... ],
   *   build(p, ctx) { ctx.box(0, 0, 0, p.w, p.d, p.h, p.color); }
   * }
   * Param tipleri: number | text | color | select (options: [[değer, etiket], ...]) | check
   */
  function register(def) {
    if (!def || !def.type || typeof def.build !== 'function') throw new Error('LS.register: type ve build zorunlu');
    if (types[def.type]) console.warn('LS.register: tip yeniden tanımlandı:', def.type);
    def.label = def.label || def.type;
    def.category = def.category || 'Diğer';
    // Kütüphanede ana başlık. Verilmezse kategoriden çıkarılır: "Ev · Salon" -> grup "Ev", alt başlık "Salon".
    const m = /^(.+?) · (.+)$/.exec(def.category);
    def.group = def.group || (m ? m[1] : 'Endüstriyel');
    def.subcat = m && m[1] === def.group ? m[2] : def.category;
    def.icon = def.icon || '■';
    def.solid = def.solid !== false;
    def.defaults = Object.assign({w: 1000, d: 1000, h: 1000, color: '#7F9A8C'}, def.defaults || {});
    def.params = def.params || [];
    if (!types[def.type]) order.push(def.type);
    types[def.type] = def;
  }

  /** Bir THREE.Group için çizim yardımcıları üret. app.js kullanır. */
  function makeCtx(group, pickList, labelList) {
    const V = (x, y, z) => new THREE.Vector3(x * S, z * S, -y * S);
    const mat = (color, o = {}) => new THREE.MeshStandardMaterial({
      color: new THREE.Color(color), roughness: o.roughness ?? .7, metalness: o.metalness ?? .05,
      transparent: o.opacity !== undefined && o.opacity < 1, opacity: o.opacity ?? 1, depthWrite: !(o.opacity < 1)});
    const edges = (mesh, o) => {
      if (o.edges === false) return;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20),
        new THREE.LineBasicMaterial({color: 0x123B2C, transparent: true, opacity: o.opacity < 1 ? .3 : .45})));
    };
    const add = (mesh, o = {}) => {
      mesh.castShadow = !(o.opacity < 1); mesh.receiveShadow = true;
      group.add(mesh); if (o.pick !== false) pickList.push(mesh); return mesh;
    };
    return {
      THREE, S, group, V,
      /** Kutu. (x,y) taban merkezi, z taban yüksekliği, w×d×h ölçü (mm). */
      box(x, y, z, w, d, h, color, o = {}) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), mat(color, o));
        m.position.copy(V(x, y, z + h / 2)); edges(m, o); return add(m, o);
      },
      /** Dikey silindir. (x,y) merkez, r yarıçap. */
      cyl(x, y, z, r, h, color, o = {}) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry((o.rTop ?? r) * S, r * S, h * S, o.seg || 28), mat(color, o));
        m.position.copy(V(x, y, z + h / 2)); edges(m, Object.assign({edges: false}, o)); return add(m, o);
      },
      sphere(x, y, z, r, color, o = {}) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r * S, 24, 16), mat(color, o));
        m.position.copy(V(x, y, z)); return add(m, o);
      },
      /** Çokgen prizma. pts = [[x,y], ...] yerel mm (merkeze göre), z taban, h yükseklik. */
      poly(pts, z, h, color, o = {}) {
        const shp = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * S, y * S)));
        const geo = new THREE.ExtrudeGeometry(shp, {depth: h * S, bevelEnabled: false, curveSegments: 24});
        const m = new THREE.Mesh(geo, mat(color, o)); m.rotation.x = -Math.PI / 2; m.position.y = z * S;
        edges(m, o); return add(m, o);
      },
      /** Çizgi. pts = [[x,y,z], ...] */
      line(pts, color = '#123B2C', o = {}) {
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => V(p[0], p[1], p[2] || 0))),
          new THREE.LineBasicMaterial({color: new THREE.Color(color)}));
        group.add(l); return l;
      },
      /** Ekranda sabit boyutlu yazı (CSS). */
      text(str, x, y, z, cls = 'obj-note') {
        const d = document.createElement('div'); d.className = cls; d.textContent = str;
        const o = new THREE.CSS2DObject(d); o.position.copy(V(x, y, z)); group.add(o); labelList.push(o); return o;
      },
      /** Masa: tabla + 4 ayak. */
      table(w, d, h, color, top = 50, leg = 40) {
        this.box(0, 0, h - top, w, d, top, color);
        const lx = w / 2 - leg / 2 - 20, ly = d / 2 - leg / 2 - 20;
        [[-lx, -ly], [lx, -ly], [-lx, ly], [lx, ly]].forEach(([x, y]) => this.box(x, y, 0, leg, leg, h - top, '#5E6E66'));
      },
    };
  }

  return {S, types, order, register, makeCtx};
})();
