# Codex'e verilecek geliştirme talimatı

Bu klasörü Codex ortamına vererek aşağıdaki talimatı kullan:

> Elimde `Akış Finans` adında çalışan, Türkçe, mobil öncelikli bir PWA var. Mevcut `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest` ve `README.md` dosyalarını **önce oku**. Mevcut özellikleri ve finans hesaplarını bozmadan projeyi profesyonel, tek kullanıcılı kişisel finans takip uygulamasına geliştir. Hedef telefon iPhone. İlk aşamada uygulamayı PWA olarak çalışır tut; daha sonra istenirse Expo/React Native veya SwiftUI geçiş planını çıkar.
>
> **Öncelikler:**
> 1. Varlık/kredi kartı işlemleri için ayrı veri modeli; bir kart için birden fazla alışveriş, taksit ve dönem; düzenli kredi ödemelerinde başlangıç/son ay.
> 2. Her kart için kesim ve son ödeme tarihleri, kullanıcının düzeltebildiği ilk ekstre ayı, banka ekstrenin fiili tutarını manuel girebilme ve plan-gerçekleşen farkını gösterebilme.
> 3. Aylık/haftalık/gelecek 30 gün nakit akışı; maaş gününden önce ödeme varsa negatif bakiye uyarısı; günlük nakit projeksiyonu; ay değişiminde gerçek dönem devir bakiyesi ve manuel mutabakat.
> 4. İsteğe bağlı yerel şifreleme ve Face ID (yerel uygulamaya geçilirse güvenli anahtar zinciri/Keychain); cihaz içi veri tutma ve güvenli yedekleme. Tam kart numarası/CVV/parola saklama.
> 5. Yerel bildirim izni alındığında son ödeme gününden 3 ve 1 gün önce hatırlatma. İzin verilmezse takvimle çalışmaya devam.
> 6. Ay bazlı kategori raporları, harcama sınırları, düzenli birikim hedefleri, borçların bitiş takvimi.
> 7. JSON içe/dışa aktarımını koru; veri formatı değişirse migration hazırla. Para tutarlarını **kuruş cinsinden tam sayı** sakla, kayan nokta hatası üretme.
> 8. Otomatik testler ekle: 31 Şubat gün düzeltme, ay/yıl dönüşleri, 3'e bölünemeyen taksitler, erken biten kredi, farklı kart ödeme günleri, birden çok harcama, tek seferlik nakit işlemleri, yedek geri yükleme, verileri silme.
>
> **UI yönü:** Koyu lacivert + turkuaz, premium banka uygulaması seviyesinde, hızlı ve sade. Özet ekranında: “Bu ay ayırabileceğin”, “Gelecek ay ne kadar borcum var?”, “İlk hangi ödeme geliyor?”, “Taksitler ne zaman bitiyor?”. Mobil erişilebilirlik, büyük dokunma alanları, Türkçe sayı/tarih biçimleri.
>
> **Çalışma ilkeleri:** Mevcut dosyaları referans al, örnek veriler ile gerçek kullanıcı verilerini karıştırma. Gerçek kullanıcı finans bilgilerini harici sunucuya gönderecek özellik ekleme; internet bağlantısı/entegrasyon gerektiren her özelliği önce kullanıcı onayına bağla. Her aşamada çalışan kod, test, güncellenmiş README ve değişiklik listesi sun.

## Sıradaki somut iş

Codex'ten önce **günlük nakit akışı ve gerçek/planlanan tutar ayrımı** eklemesini iste. Çünkü ay bazında serbest bütçe pozitif olsa bile maaş gününden önce kredi kartı/kredi ödeme günü geliyorsa kısa süreli nakit açığı olabilir.
