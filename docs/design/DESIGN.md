# DESIGN.md: MobilJuragan Digital Rental Service

Arah desain (design direction) untuk prototype Tugas 1: mobile app pelanggan + web dashboard admin.
Kasus: CV. Mobil Juragan Express Transport, Merauke, Papua Selatan.
Sumber data nyata: https://mobiljuragan.com dan https://mobiljuragan.com/order_mobil_web

Dokumen ini adalah acuan (direction). Aturan antislop yang dirujuk: core `antislop.md` (R-01..R-38, C-1..C-5, Delivery Gate), `antislop-ui`, `antislop-layoutmobile`.

---

## 1. Design Read (satu kalimat wajib sebelum menggambar)

> Reading this as: aplikasi layanan rental mobil lokal untuk pelanggan umum dan admin usaha di Merauke, dalam bahasa visual "layanan transportasi yang jelas, praktis, dapat dipercaya", dial ENERGY 2 / RHYTHM 2 / MOTION 1.

## 2. Identitas produk

| Aspek | Keputusan | Alasan (R-31) |
|---|---|---|
| Karakter | Jelas, praktis, dapat dipercaya | Pelanggan butuh kepastian kendaraan, jadwal, tarif, dan status; kepercayaan adalah inti jasa rental (sesuai nilai kejujuran yang ditampilkan situs) |
| Mood | Tenang, informatif, bukan promosi berlebihan | Tugas pengguna adalah memesan dan memantau booking, bukan browsing hiburan |
| Tema | Light theme | Form booking, tabel admin, dan teks panjang lebih cepat dibaca di layar terang; tidak ada alasan brand untuk dark default (R-21) |
| Identity motif | Plat nomor kendaraan sebagai penanda visual | Data paling nyata dari bisnis ini adalah plat nomor tiap kendaraan (9 plat asli tersedia); dipakai di vehicle card, detail mobil, dan badge armada sebagai motif berulang |
| Audience | Pelanggan pribadi (mobile) dan admin/staf (desktop) | Dua permukaan produk dengan tugas berbeda, satu sistem desain |

## 3. Dials (wajib konsisten dari screen pertama sampai terakhir)

| Dial | Nilai | Artinya |
|---|---|---|
| ENERGY | 2 (Balanced) | Tenang, tapi tetap punya fokus visual yang jelas per screen |
| RHYTHM | 2 (Balanced) | Komposisi konsisten antar screen dalam kategori sama, dengan variasi di momen penting (beranda vs form vs status) |
| MOTION | 1 (Calm) | Transisi hanya untuk perubahan status nyata (status chip, stepper, modal) |

## 4. Palette (maks 2-3 core + 1 accent, R-29)

| Token | Warna | Peran | Alasan (R-31) |
|---|---|---|---|
| navy | #1E3A5F | Core: struktur, header, primary button | Warna "juragan" yang memberi kesan stabil dan formal, cocok untuk layanan rental dengan kontrak dan jadwal |
| teal | #0E7C7B | Core: aksi positif, status aktif, link | Kontras nyaman terhadap navy, memberi rasa "siap jalan" tanpa jadi warna promo yang berisik |
| neutral-bg | #F5F7FA | Core netral: latar | Basis terang agar kartu dan tabel menonjol (netral tidak dihitung core palette) |
| neutral-line | #E2E8F0 | Garis dan border | Pemisah halus tanpa mengalahkan konten |
| text-main | #0F172A | Teks utama | Kontras AA terhadap #F5F7FA (rasio jauh di atas 4.5:1) |
| gold | #D4A017 | Accent: maksimal 1 momen perhatian per screen | Penanda "perlu perhatian" (booking menunggu konfirmasi, tarif belum final). Bukan dekorasi |

Aturan pakai (antislop-ui):
- Accent gold HANYA di momen kunci, satu per screen. Kalau muncul di banyak elemen, itu FAIL (excessive accent).
- Tidak ada gradient background, tidak ada glow, tidak ada glassmorphism (dose cap 0 untuk produk ini, R-01/R-10/R-13).
- Teks putih di atas navy dan teal wajib lolos WCAG AA: 4.5:1 teks normal, 3:1 teks besar 18px+ (R-25).

## 5. Tipografi

| Token | Ukuran | Kegunaan |
|---|---|---|
| H1 | 24px mobile / 32px desktop, semibold | Judul utama screen |
| H2 | 20px / 24px, semibold | Judul section |
| Body | 14-16px, regular | Konten utama |
| Caption | 12px, regular | Keterangan kecil, label tabel |

- Typeface: Inter. Alasan (R-06): sans-serif dengan dukungan angka yang jelas untuk plat nomor, tarif, jam, dan tabel; bukan pilihan "default AI" melainkan pilihan keterbacaan data.
- Headings sentence case. Dilarang: all-caps dengan letter-spacing lebar, monospace sebagai gaya (R-06).

## 6. Spacing, radius, shadow (disiplin, bukan dekorasi)

| Elemen | Nilai | Alasan (R-31) |
|---|---|---|
| Spacing grid | kelipatan 8px | Ritme terukur untuk daftar kendaraan, form, dan tabel |
| Radius kecil | 4px | Input, badge, chip |
| Radius sedang | 8px | Kartu, tabel |
| Radius besar | 12px | Primary CTA saja (satu elemen "bulat" yang disengaja, bukan semua elemen pill) |
| Shadow level 1 | 0 1px 3px rgba(15,23,42,.08) | Hanya kartu yang "terangkat" dari latar |
| Shadow level 2 | 0 4px 12px rgba(15,23,42,.14) | Hanya primary CTA dan modal |
| Tanpa shadow | border #E2E8F0 | Baris tabel, input, list biasa |

Aturan antislop-ui: maksimal 2 level elevasi (R-12). Kalau semua kartu mengambang, FAIL. Radius seragam pill di semua elemen juga FAIL (R-11).

## 7. Komponen (design system page wajib ada)

- Buttons: primary (navy), secondary (teal outline), ghost (text only), danger (hanya untuk aksi merusak).
- Inputs: label selalu terlihat, placeholder jujur ("Nama sesuai KTP", "08xx-xxxx-xxxx"), error inline di bawah field.
- Badge & status chips: Tersedia (teal), Disewa (navy), Servis (abu), Menunggu Konfirmasi (gold, satu-satunya pengguna gold).
- Vehicle card: foto placeholder, nama, plat nomor sebagai motif identitas, badge ketersediaan.
- Booking card: pemesan, kendaraan, tanggal, status, aksi utama.
- Stepper: Permintaan diterima -> Cek kendaraan -> Konfirmasi tarif -> Siap.
- Modal: untuk konfirmasi dan detail ringkas, closable.

CTA wajib spesifik produk (R-15): "Pesan Mobil", "Pilih Tanggal", "Kirim Pesanan", "Konfirmasi Booking". Dilarang: "Get Started", "Learn More", "Explore".

Copywriting (R-02, R-16): Bahasa Indonesia, tanpa em dash, tanpa emoji dekoratif, tanpa buzzword ("AI Powered", "Seamless", "Next Generation").

## 8. Aturan mobile (390x844, dari antislop-layoutmobile)

- Layout mobile adalah layout sendiri, bukan desktop yang dikecilkan.
- Semua tap target >= 44x44 px, dengan jarak jelas antar target.
- Bottom nav berlabel (icon + teks): Beranda, Pesan, Status, Bantuan. Respect safe area, konten tidak pernah tertutup nav.
- Tidak ada overflow horizontal di frame 390px. List menumpuk vertikal, bukan kolom yang dipaksa.
- Aksi utama screen tetap terlihat tanpa scroll berlebihan ("Kirim Pesanan" di atas bottom nav).

## 9. Aturan dashboard (1440x900, dari antislop-ui bagian App & Dashboard)

- Layout dibangun dari keputusan admin: "booking mana yang harus saya konfirmasi berikutnya". Antrean booking adalah konten utama, bukan sidebar + 4 kartu stat + chart + tabel default.
- Dilarang angka statistik fiktif dan delta palsu. Angka hanya: 0 (dengan empty state) atau berlabel "Data contoh" (R-17, R-38).
- Dilarang activity feed dengan nama orang fiktif (R-18).
- Chart hanya kalau menjawab pertanyaan nyata dan judulnya menyatakan pertanyaan itu. Kalau tidak, pakai list/tabel.
- Kolom tabel mengikuti keputusan: Pemesan, Kendaraan, Tanggal, Status, Aksi. Aksi yang ada: buka detail, konfirmasi, tolak. Sisanya dibuang (R-26).
- Sel kosong dibiarkan kosong atau pakai placeholder jujur, bukan data palsu gaya "John Doe" (R-23, R-38).

## 10. Data integrity (Hard Gate, mutlak)

- Hanya 9 kendaraan nyata ini: AVANZA G PUTIH PS1692B, FORTUNER VRZ TRD HITAM B8833AKU, HILUX G HITAM PA8593GZ, INNOVA REBORN G HITAM PA1504G, PICKUP SUZUKI CARRY HITAM B9762BAY, RUSH G ALL NEW COKLAT PA1696GG, TERIOS X HIJAU MATIC B2534KRB, VELOZ MERAH PS1693B, XPANDER EXCEED HITAM PS1691B.
- Tidak boleh mengarang: harga, rating, review, testimoni, pendapatan, jumlah booking, nama pelanggan, waktu respons (R-17, R-18, R-36, R-38).
- Harga belum ada: tulis "Tarif dikonfirmasi tim MobilJuragan" atau "Menunggu konfirmasi tarif".
- Nilai contoh diberi tag terlihat "Data contoh".

## 11. States (R-27, wajib tiga kondisi)

- Empty: sebab + satu aksi. Contoh: "Belum ada mobil tersedia untuk tanggal ini. Coba tanggal lain." + tombol.
- Loading: menyebut apa yang dimuat. Contoh: "Memuat daftar mobil..."
- Error: apa yang gagal + langkah berikutnya. Contoh: "Gagal memuat data. Periksa koneksi." + "Coba lagi".
- Setiap tombol punya prototype link atau label "Segera hadir". Tidak ada kontrol mati (R-26).

## 12. Motion (R-19)

- Smart animate hanya untuk perubahan state nyata: status chip berganti, stepper maju, modal buka.
- Tidak ada loop abadi, tidak ada elemen melayang/pulse dekoratif, tidak ada animasi template yang ditumpuk.
- Maksimal satu mikro-interaksi per screen.

## 13. Delivery Gate (ringkasan cek sebelum dikumpulkan)

Semua jawaban di bawah harus "tidak ada pelanggaran":

- [ ] Tidak ada em dash pada semua teks UI (R-02)
- [ ] Tidak ada overflow / layout patah di 390px dan 1440px (R-03)
- [ ] Tidak ada angka, statistik, delta, testimoni, atau orang fiktif (R-17, R-18, R-38)
- [ ] Semua aset visual jujur: placeholder berlabel, bukan dibuat seolah final (R-23)
- [ ] Semua navigasi dan tombol punya tujuan nyata atau label "Segera hadir" (R-24, R-26)
- [ ] Kontras teks lolos WCAG AA (R-25)
- [ ] Empty, loading, error state ada di daftar kendaraan, booking, dan tabel (R-27)
- [ ] Palette <= 3 core + 1 accent, gold hanya di momen kunci (R-29)
- [ ] Radius 4/8/12 dan shadow 2 level dipakai sesuai disiplin (R-11, R-12)
- [ ] Tidak ada gradient/glow/glass/grid tekstur dekoratif (R-01, R-07, R-10, R-13)
- [ ] CTA spesifik produk, bukan generik (R-15)
- [ ] Microcopy Bahasa Indonesia, layer name English
- [ ] Dials ENERGY 2 / RHYTHM 2 / MOTION 1 konsisten
- [ ] Design Read sudah dideklarasikan sebelum menggambar
- [ ] Identitas tetap terasa MobilJuragan walau logo ditukar (C-1, R-20)

## 14. Cara pakai dokumen ini

1. Agent builder (VS Code + Figma MCP): baca dokumen ini SEBELUM membuat frame. Setiap keputusan visual yang tidak bisa dijelaskan dalam satu baris alasan wajib dibatalkan (R-31).
2. Agent reviewer: jadikan bagian 8-13 sebagai checklist audit. Setiap temuan harus menyebut frame dan rule yang dilanggar.
3. Mode antislop: DURING (aturan diterapkan saat membangun), dan AFTER (audit lewat Delivery Gate sebelum dikumpulkan).

## 15. Eksplorasi Sandbox: Quiet Luxury & Utilitarian Clarity (17 September 2026)

Untuk mengatasi kesan generic/sterile default dari palet awal (`#F5F7FA` + `#1E3A5F`), dibangun sandbox eksplorasi khusus di Figma:
- **Sandbox Lo-Fi (`1058:320`):** 11 Layar monokromatis terstruktur + Papan Anotasi Laws of UX (Fitts, Hick, Jakob, Miller, Proximity).
- **Sandbox Hi-Fi (`1058:321`):** 11 Layar dengan sistem token baru:
  - **Warm Alabaster (`#FAFAF8`):** Latar belakang kanvas yang meniru permukaan kertas editorial, lebih hangat dan tahan silau matahari Merauke.
  - **Obsidian Ink (`#0B111D`):** Header ramping dan tombol aksi utama (CTA) dengan kontras tegas 18.5:1 AAA.
  - **Austral Deep Teal (`#006D77`):** Aksen positif, status aktif, dan checkmark dengan kontras 6.14:1 AA.
  - **Austral Mist (`#EBF5F4`):** Permukaan tonal untuk gelembung chat AI Assistant.
  - **Ikon Navigasi Vektor:** Instance vektor SVG resmi (`Icon/Home`, `Icon/Car`, `Icon/Status`, `Icon/Help`) dari master page `890:2`.
  - **Data Integritas:** Berakar ketat pada data 9 armada asli dan operasional riil [mobiljuragan.com](https://mobiljuragan.com/) di Merauke, Papua Selatan.

