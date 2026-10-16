# Yerleşim Stüdyosu – şablon

Tarayıcıda çalışan, sürükle-bırak yerleşim (layout) uygulaması şablonu.
İnternet gerekmez. Sunucu gerekmez. Ubuntu'da `index.html` dosyasını Firefox veya Chrome ile açın.

## Klasör yapısı

| Yol | İçerik | Değiştirir misiniz? |
|-----|--------|---------------------|
| `index.html` | Arayüz iskeleti ve stiller | Görünüm için |
| `src/core.js` | Nesne kayıt sistemi (`LS.register`) ve çizim yardımcıları (`ctx`) | Nadiren |
| `src/objects.js` | Nesne kütüphanesi (endüstriyel) | **Evet – yeni nesneler buraya** |
| `src/objects-ev.js` | Ev eşyaları kütüphanesi (`ev_` ön ekli tipler) | Ev nesneleri için |
| `src/app.js` | Sahne, seçim, sürükleme, geri al, kaydet | Yeni özellik için |
| `vendor/` | three.js r128 (MIT lisansı, çevrimdışı) | Hayır |

## Yeni nesne ekleme

`src/objects.js` dosyasının sonuna bir blok ekleyin. Sayfayı yenileyin. Nesne kütüphanede görünür.

```js
LS.register({
  type: 'palet',                 // JSON'a yazılır. Kullanmaya başladıktan sonra DEĞİŞTİRMEYİN.
  label: 'Palet', category: 'Lojistik', icon: '▦',
  solid: true,                   // false: çakışma kontrolüne girmez
  defaults: {w: 1200, d: 800, h: 150, color: '#C8A46E', yuk: 0},
  params: [
    {key: 'w', label: 'Genişlik', type: 'number', unit: 'mm', min: 100, step: 10},
    {key: 'd', label: 'Derinlik', type: 'number', unit: 'mm', min: 100, step: 10},
    {key: 'yuk', label: 'Yük yüksekliği', type: 'number', unit: 'mm', min: 0, step: 50},
    {key: 'color', label: 'Renk', type: 'color'},
  ],
  build(p, c) {                  // Nesneyi MERKEZİ (0,0) olacak şekilde çizin. Ölçüler mm.
    c.box(0, 0, 0, p.w, p.d, p.h, p.color);
    if (p.yuk > 0) c.box(0, 0, p.h, p.w - 50, p.d - 50, p.yuk, '#8A9A91', {opacity: .7});
  },
});
```

Nesneleri ayrı bir dosyada tutmak isterseniz `src/my-objects.js` oluşturun ve `index.html` içinde `objects.js` satırının altına ekleyin.

### Parametre tipleri

| `type` | Panelde | Örnek |
|--------|---------|-------|
| `number` | Sayı kutusu (`min`, `max`, `step`, `unit`) | `{key:'w', type:'number', unit:'mm'}` |
| `text` | Metin kutusu | `{key:'etiket', type:'text'}` |
| `color` | Renk seçici | `{key:'color', type:'color'}` |
| `check` | Onay kutusu | `{key:'opak', type:'check'}` |
| `select` | Liste | `{key:'tip', type:'select', options:[['a','A tipi'],['b','B tipi']]}` |

### Çizim yardımcıları (`build(p, c)` içindeki `c`)

Koordinat: X sağa, Y arkaya (planda yukarı), Z yukarı. Birim mm. `(x, y)` nesne merkezine göredir.

| Fonksiyon | Açıklama |
|-----------|----------|
| `c.box(x, y, z, w, d, h, renk, {opacity})` | Kutu. `(x,y)` taban merkezi, `z` taban yüksekliği |
| `c.cyl(x, y, z, r, h, renk, {rTop, seg})` | Dikey silindir |
| `c.sphere(x, y, z, r, renk)` | Küre |
| `c.poly([[x,y],...], z, h, renk)` | Çokgen prizma (L, U, pahlı şekiller) |
| `c.line([[x,y,z],...], renk)` | Çizgi |
| `c.text(metin, x, y, z, cssSınıfı)` | Ekranda sabit boyutlu yazı |
| `c.table(w, d, h, renk)` | Tabla + 4 ayak |
| `c.THREE`, `c.group` | İleri kullanım: doğrudan three.js nesnesi ekleyin |

Seçeneklerde `{pick:false}` verilen parça tıklanmaz ve seçim kutusuna girmez.

## Kullanım

| İşlem | Nasıl |
|-------|-------|
| Ekle | Kütüphaneden sahneye sürükleyin veya tıklayın |
| Taşı | Nesneyi sürükleyin (adım: üst çubuk) |
| Çoklu seçim | Shift + tıklama, Ctrl+A |
| Döndür | R / Shift+R (adım: 15°, 45°, 90°) |
| Kaydır | Ok tuşları (Shift: 10 mm) |
| Çoğalt / sil | Ctrl+D / Delete |
| Geri al / yinele | Ctrl+Z / Ctrl+Y |
| Ölçü al | M, sonra iki noktaya tıklayın. Araç açık kalır; Esc çizimi iptal eder, ikinci Esc araçtan çıkar |
| Ölçüde yakalama | Köşe ■, kenar ortası ■, kenar ◇ (kesik çizgi), merkez ● otomatik yakalanır |
| Ölçüde kilit | Shift: yalnız yatay veya dikey ölçü |
| Ölçüde serbest nokta | Ctrl basılı tutun: yakalama ve ızgara kapanır |
| İki nesne arası boşluk | Shift + tıklama ile 2 nesne seçin. Sağ panel X/Y boşluğunu, net ve merkez mesafesini gösterir. "Boşluğa ölçü çizgisi ekle" ile kalıcı ölçü oluşur |
| Görünüm | 1 = plan, 2 = 3D |
| Kaydet / aç | Kaydet (Ctrl+S) JSON indirir. Aç ile JSON yüklenir |

Çalışma tarayıcıya otomatik kaydedilir. Bu kayıt yalnız o tarayıcıdadır. Paylaşmak veya yedeklemek için **Kaydet** ile JSON dosyası alın.

## Ev eşyaları (`src/objects-ev.js`)

Varsayılan ölçüler yaygın piyasa ölçüleridir. Gerçek ürün ölçüsünü panelden girin.

| Kategori | Nesneler (`type`) |
|----------|-------------------|
| Ev · Yapı | Oda – 4 duvar, ön duvarda kapı boşluğu (`ev_oda`), Kapı – açılım yayı ile (`ev_kapi`), Pencere (`ev_pencere`) |
| Ev · Salon | Kanepe (`ev_kanepe`), Tekli koltuk (`ev_koltuk`), Köşe koltuk (`ev_kanepe_l`), Orta sehpa (`ev_sehpa`), TV ünitesi (`ev_tv_unitesi`), Kitaplık (`ev_kitaplik`), Halı (`ev_hali`), Saksı bitki (`ev_bitki`), Lambader (`ev_lambader`) |
| Ev · Yemek | Yemek masası – sandalyeli (`ev_yemek_masasi`), Sandalye (`ev_sandalye`), Çalışma masası (`ev_calisma_masasi`) |
| Ev · Yatak odası | Yatak (`ev_yatak`), Komodin (`ev_komodin`), Gardırop – kapak açılım alanı ile (`ev_gardirop`) |
| Ev · Mutfak | Dolap + tezgah – üst dolaplı (`ev_mutfak_tezgah`), Buzdolabı (`ev_buzdolabi`), Fırınlı ocak (`ev_ocak`), Bulaşık makinesi (`ev_bulasik`), Çamaşır makinesi (`ev_camasir`) |
| Ev · Banyo | Lavabo dolabı (`ev_lavabo`), Klozet (`ev_klozet`), Duş teknesi (`ev_dus`), Küvet (`ev_kuvet`) |

Notlar:
- Oda, kapı, pencere ve halı çakışma kontrolüne girmez (`solid: false`).
- Oda iç ölçü ile tanımlanır; duvarlar dışa doğru çizilir. "Duvarları alçak göster" 3D görünümde duvarı 900 mm keser; gerçek yükseklik parametrede kalır.
- Kapıyı odanın ön duvar boşluğuna yerleştirin (`kapiX` ile boşluğu kaydırın). Diğer duvarlarda boşluk için ayrı `duvar` parçaları kullanın.
- Boşluk ölçümü dünya eksenine hizalı dış kutuyu kullanır. 90° katı olmayan açıda değer yaklaşıktır; panel bunu belirtir.

## JSON biçimi

```json
{
  "app": "yerlesim-studyosu", "version": 1, "name": "Hat 1",
  "area": {"w": 6000, "d": 4000},
  "objects": [
    {"id": "o1a2b3", "type": "konveyor", "name": "Konveyör 1",
     "x": 1500, "y": 500, "rot": 90, "locked": false, "params": {"w": 3000}}
  ]
}
```

`x, y` nesne merkezidir (mm). `rot` saat yönünde derecedir. `params` yalnız varsayılandan farklı değerleri tutar.
Tanımsız bir `type` içeren dosya açılırsa o nesne kırmızı kutu olarak gösterilir; veri kaybolmaz.

## Konsoldan erişim

Tarayıcı konsolunda `Studio.state`, `Studio.addObj('masa', 1000, 2000)`, `Studio.select([...])`, `Studio.setView('3d')`.

## Lisans

`vendor/` içindeki three.js MIT lisanslıdır (`vendor/THREE_LICENSE.txt`).
