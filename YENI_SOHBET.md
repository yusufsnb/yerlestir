# Yeni sohbet için başlangıç metni

Aşağıdaki metni yeni bir sohbete yapıştırın ve `yerlesim-studyosu.zip` dosyasını ekleyin.

---

Ekteki "Yerleşim Stüdyosu" şablonunu geliştirmek istiyorum. Tarayıcıda çevrimdışı çalışan, three.js r128 tabanlı bir sürükle-bırak yerleşim uygulaması. Ubuntu'da Firefox ile açıyorum.

Yapı:
- `src/core.js`: `LS.register()` kayıt sistemi ve `ctx` çizim yardımcıları
- `src/objects.js`: nesne kütüphanesi (yeni nesneler buraya)
- `src/app.js`: sahne, seçim, sürükleme, geri al, JSON kaydet/aç

Kurallar:
- Mevcut `type` anahtarlarını değiştirme (kayıtlı JSON dosyaları bozulur).
- Yeni nesneleri `LS.register` ile ekle; `app.js`'i yalnız yeni özellik gerekiyorsa değiştir.
- Ölçüler mm. Nesne merkezi (0,0). X sağa, Y arkaya, Z yukarı.
- Harici CDN kullanma; her şey çevrimdışı çalışmalı.

İlk isteğim: [buraya yazın]
