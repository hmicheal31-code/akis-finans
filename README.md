# Akış Finans — kişisel finans takip uygulaması

**Çalışan sürüm:** v1.0 (2026). iPhone, Android ve masaüstü tarayıcıları için mobil öncelikli, kurulabilir web uygulaması (PWA). Sunucu, üyelik, banka bağlantısı ve ücretli servis gerektirmez.

## Ne yapar?

- Birden çok kredi kartı tanımlama; ekstre kesim ve son ödeme günleri.
- Her alışverişi toplam fiyatı, taksit adedi ve ilk **ödeme ayıyla** kaydetme.
- Taksitleri aylara dağıtma; kartın aylık toplam ödemesini, kalan planlı taksitleri ve son ödeme ayını gösterme.
- Düzenli maaş/gelir, kredi ve sabit gider tanımlama; isteğe bağlı son ödeme ayı.
- Tek seferlik nakit gelir/gider ekleme.
- Aylık **serbest bütçe**, gelir-gider, kredi/kart yükü; sonraki 3, 6 ve 12 ayı planlama.
- Ödemeyi/geliri gerçekleştiğinde işaretleme; aylık ödenmedi diye işaretli tutar.
- İsteğe bağlı açılış nakit bakiyesiyle ay sonu nakit projeksiyonu.
- JSON yedek alma ve geri yükleme. Örnek verilerle deneme.

## 1. İlk açılış

Bilgisayarda `index.html` dosyasını açabilirsin. Dosyalar tek klasörde kaldığı sürece hesaplayıcı çalışır. **Gerçek iPhone uygulaması gibi ana ekrana ekleyip çevrimdışı kullanmak için HTTPS adresinde yayınlamak gerekir.**

## 2. iPhone'a uygulama olarak kurma (GitHub Pages)

1. [github.com](https://github.com) hesabında yeni bir **Public** depo (repository) oluştur. Örneğin `akis-finans`.
2. Bu ZIP'i aç; `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `icons` klasörünü deponun **kök dizinine** yükle. GitHub üzerinden `Add file > Upload files` kullanılabilir.
3. Depoda `Settings > Pages > Build and deployment > Deploy from a branch` bölümünden `main` ve `/ (root)` seçeneğini kaydet.
4. GitHub'ın Pages bölümünde oluşturduğu **HTTPS site adresini** iPhone'un Safari tarayıcısında aç.
5. Safari'de **Paylaş > Ana Ekrana Ekle** seç. Artık ana ekrandaki Akış simgesinden açabilirsin. İlk başarılı yükleme ve önbellekleme sonrası çevrimdışı da açılabilir.

Not: GitHub Pages adresini başka biri açabilir; fakat **senin girdiğin finans verileri GitHub'a yüklenmez**, yalnızca senin kullandığın tarayıcı/cihazın depolamasında bulunur. Kod deposuna `*.json` yedeklerini, gerçek finans kayıtlarını ya da banka bilgilerini **asla yükleme**.

İstersen daha sonra bu PWA'yı Codex ile Expo/React Native veya SwiftUI kullanarak gerçek yerel mobil uygulamaya çevirebiliriz.

## 3. Verileri hangi sırada girmelisin?

1. **Kartlar > Kart ekle:** Banka/kart takma adı, kesim günü ve son ödeme günü. Son 4 hane isteğe bağlı.
2. **Taksit ekle:** Açıklama, bağlı kart, **alışverişin toplam tutarı**, taksit sayısı, ilk **ekstre ödeme ayı**. Örn. 18.000 ₺ / 6 taksit; ilk ödeme Aralık 2026 ise Aralık–Mayıs arasında toplam 3.000 ₺/ay hesaplanır.
3. **Gelir ekle:** Maaş tutarı, her ay hesaba geçtiği gün, başlangıç ayı.
4. **Kredi / gider ekle:** Aylık kredi taksiti, ayın ödeme günü, ilk ve son taksit ayı. Aileyle ortak ödeniyorsa **kişisel bütçenden gerçekten çıkan payı** yaz.
5. **Ayarlar:** Aylık birikim hedefi. İstersen belirlediğin ayın 1'indeki toplam nakit tutarı.
6. **Takvim:** Gerçekten ödediğin/aldığın hareketleri daire butonuyla işaretle. Üstte aylar arasında gezin.

**Önemli:** Aynı kredi kartı alışverişini ayrıca “tek seferlik nakit gideri” olarak ekleme; harcama iki kere sayılır.

## Hesaplama yaklaşımı

- `Kart taksiti`: Toplam tutar, taksit sayısına kuruş bazında bölünür; en fazla 1 kuruşluk farklar ilk taksitlere dağıtılır. Tüm taksitlerin toplamı orijinal tutara eşittir.
- `Aylık bütçe`: Beklenen aylık gelir − planlanan kart/kredi/diğer giderleri − birikim hedefi.
- `Ay sonu nakit tahmini`: Kullanıcının belirttiği ay başı nakit bakiyesi + bu aydan itibaren planlanan tüm net aylık hareketler.
- `Ödendi` işareti yalnızca gerçekleşme durumunu takip eder; aylık gider planından tutarı ikinci kez düşmez.
- Kart kesim günü **bilgilendirme amaçlı** gösterilir. İlk ödeme ayını kullanıcı belirler; banka bazlı kesim/hesaplama otomatik yapılmaz.
- Ayın 29, 30 veya 31'i seçilmişse, kısa aylarda o ayın son günü kullanılır.

**Bunlar beklenti planlarıdır:** Faiz, gecikme cezası, kart asgari ödeme, değişken faiz, taksit ertelemesi, döviz işlemleri, kredi erken kapama veya bankayla bire bir ekstre mutabakatı hesaplanmaz. Verileri bankanın ekstresiyle kontrol et.

## Gizlilik, güvenlik ve yedekleme

- Harici API, analytics, kullanıcı hesabı, reklam, banka bağlantısı **yoktur**.
- Finans kayıtları tarayıcıdaki **localStorage** içinde, **şifrelenmeden** tutulur. Bu nedenle cihazının kilidini aktif tut.
- Safari verisini silmek, telefonu değiştirmek veya uygulamayı silmek kayıtların kaybolmasına yol açabilir. **Ayarlar > JSON yedeği indir** bölümünden düzenli yedek al, yedeği güvenli sakla.
- Kart numarasının tamamı, CVV, banka şifresi, kimlik veya hesap numarası kaydetme.
- Bu ilk sürümde bildirim/hatırlatma, Face ID/PIN kilidi, cihazlar arası senkronizasyon ve otomatik banka entegrasyonu **yoktur**. Bunlar ileride geliştirilebilir.

## Teknik yapı

Statik HTML/CSS/JavaScript + PWA manifest + service worker. Dış bağımlılık yoktur; sunucu, veritabanı veya derleme aşaması gerekmez. `node --check app.js` ile sözdizimi kontrolü yapılabilir. `tests/logic.test.cjs` ile temel hesaplamalar kontrol edilir (`node tests/logic.test.cjs`).

**Sürüm güncellemesi:** Uygulama kodunu güncellerken `sw.js` içindeki `CACHE` sürümünü artır; aksi halde kullanıcılar eski önbelleği görebilir. Kullanıcı verisini saklayan `localStorage` anahtarını değiştirme veya veri migrasyonu yaz.
