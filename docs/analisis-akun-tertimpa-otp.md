# Analisis & Rencana: Akun Pelanggan Tertimpa Saat Registrasi OTP

**Status:** Identifikasi masalah — belum ada perubahan kode
**Tanggal:** 8 November 2026
**Cakupan:** `mobiljuragan-backend` (utama), `mobiljuragan-mobile` (kontributor), `mobiljuragan-dashboard` (tidak terlibat)

---

## 1. Ringkasan Eksekutif

Terjadi **pengambilalihan akun (account takeover) tanpa disengaja** pada alur registrasi pelanggan.

Seseorang membuka aplikasi, mengisi nama **"Yahya"**, lalu memakai nomor **+6281248002910** yang sudah dimiliki akun **"Harun"**. Sistem **mengganti nama akun Harun menjadi Yahya** dan menyerahkan sesi login ke Yahya. Tidak ada satu pun pemeriksaan yang menahan langkah itu.

Akibatnya bukan sekadar nama berubah:

| Dampak | Bukti |
|---|---|
| Identitas pemilik diganti | `users.fullName`: `Harun` → `Yahya` |
| Riwayat sewa ikut berpindah tangan | **7 booking** milik akun itu kini tampil atas nama "Yahya" |
| Riwayat bantuan ikut terbawa | **2 tiket** dukungan |
| Dokumen pribadi (e-KTP, SIM, form kesanggupan) dapat diakses | rute dokumen memeriksa `customerId` |
| Jejak audit hilang | tidak ada catatan siapa yang mengubah nama, kapan, dari mana |

Ini **bukan bug kosmetik**. Untuk bisnis rental, nama pada akun adalah pihak yang menandatangani kontrak dan bertanggung jawab atas unit. Nama yang salah membuat kontrak, surat pernyataan, dan verifikasi KTP tidak lagi sinkron.

### Temuan kedua: "akun hantu" yang tidak pernah ada di database

Di emulator, aplikasi tampil **sudah login** dengan inisial **"PA"** lengkap dengan riwayat pesanan, padahal di database hanya ada satu pelanggan (**Yahya**) dan riwayat itu **tidak muncul di dashboard**.

Ini **bukan hardcode**, tetapi **identitas karangan klien**. Rantainya:

1. `verifyOtp` / `verifyRegisterOtp` punya fallback yang menerima kode `123456`, `888888`, atau `1234` **tanpa memanggil server** (`auth_controller.dart` lama, baris 184 dan 243).
2. Saat fallback itu dipakai, aplikasi membuat `UserModel` dengan **id karangan** `USR-MKQ-<timestamp>`.
3. `_saveSecureTokenAsync` menulis token palsu `secure_session_<timestamp>` ke secure storage.
4. `hasValidToken()` hanya memeriksa "token ada isinya" — tidak pernah memverifikasi tanda tangan JWT ke server. Jadi setiap aplikasi dibuka, `initSession()` **memulihkan akun hantu itu** dan menampilkannya sebagai sesi sah.
5. Inisial berasal dari nama yang diketik saat registrasi. Nama yang diketik bebas di form itulah yang menghasilkan "PA".
6. Riwayat pesanan tersimpan di Drift lokal dengan `user_id` = id karangan tadi, sehingga **tidak pernah terkirim ke server** dan karena itu **tidak muncul di dashboard**.

Konfirmasi dari perangkat: database lokal emulator (`mobiljuragan_local_db.sqlite`) berisi **0 baris bookings** tetapi 9 armada, dan secure storage di perangkat terenkripsi sehingga tidak terbaca langsung. Artinya "riwayat" yang terlihat **berasal dari sesi yang dipulihkan oleh token palsu**, bukan dari server.

Kesimpulan: keduanya berakar pada masalah yang sama — **aplikasi boleh menciptakan identitas sendiri**, dan tidak ada satu pun pemeriksaan yang memastikan identitas itu berasal dari server.

### Arah solusi yang dipilih

Satu identitas (nomor HP terverifikasi) dengan **dua kredensial**: **OTP** dan **kata sandi**. Rinciannya di §6.4–§6.8, ringkasnya:

| Hal | Keputusan |
|---|---|
| Daftar | Nama + nomor + kata sandi (dengan checklist hidup) → verifikasi OTP → **baru** akun dibuat dengan kata sandi ter-hash |
| Login | Nomor HP dulu → pilih **OTP** (utama) atau **kata sandi** (alternatif). **Nama tidak pernah diminta.** |
| Nama | Selalu dibaca dari server; hanya bisa diubah lewat `PATCH /me` yang terautentikasi |
| Kata sandi | Minimal 8 karakter, wajib huruf besar+kecil+angka+simbol, maksimum 72 byte, ditolak bila sama dengan nomor/nama atau terlalu umum |
| Hashing | bcrypt (biaya 12 untuk pelanggan), `passwordHash` tidak pernah keluar dari server |

---

## 2. Bukti Empiris (dari database produksi-lokal)

```
role      phone           fullName                     dibuat                diubah
ADMIN     081234567890    Admin MobilJuragan           2026-10-06 14:02:56   2026-11-08 13:56:41
STAFF     081234567899    Staf Operasional Merauke     2026-10-06 14:02:56   2026-10-22 06:06:38
CUSTOMER  081248002910    Yahya                        2026-10-27 03:57:05   2026-11-08 14:02:20
```

Baris `CUSTOMER 081248002910` **dibuat 27 Oktober** tetapi baru **diubah 8 November 14:02:20**. Artinya baris ini bukan akun baru — ia akun lama yang **ditimpa namanya**.

Bukti pendukung lain:

- `otp_verifications` untuk nomor tersebut berisi **17 baris**, dan **7 di antaranya `consumedAt = NULL`** (kode lama tidak pernah dibatalkan saat kode baru diminta).
- `audit_logs` untuk `entityType = 'User'` hanya 5 baris (semuanya aksi admin). **Perubahan nama pelanggan tidak tercatat sama sekali.**

---

## 3. Inti Masalah

> **Sistem menulis data identitas (nama) *sebelum* memverifikasi bahwa pemohon benar-benar pemilik nomor telepon, dan menjadikan nomor telepon sebagai satu-satunya kunci identitas yang bisa ditimpa oleh siapa pun.**

Tiga kalimat yang merangkum seluruh akar masalah:

1. **Write-before-verify.** Nama ditulis ke database pada langkah *permintaan* OTP — sebelum satu digit pun diverifikasi.
2. **Nomor telepon = identitas, bukan sekadar kredensial.** Karena `phoneNumber` adalah `@unique` dan satu-satunya penanda, "mendaftar dengan nomor yang sudah ada" secara otomatis berarti "mengubah akun yang sudah ada".
3. **Tidak ada konsep "klaim nomor".** Tidak ada status `phone_verified`, tidak ada pemisahan niat *login* vs *daftar*, dan tidak ada endpoint profil resmi — sehingga satu-satunya jalan mengubah nama adalah efek samping dari minta OTP.

---

## 4. Mengapa Ini Bisa Terjadi (jejak kode)

### 4.1 Penyebab langsung — 5 baris kode

`mobiljuragan-backend/src/controller/authController.ts:21-32`

```ts
// Cari pelanggan yang sudah terdaftar, atau daftarkan kalau belum ada
let user = await authModel.findUserByPhoneNumber(phoneNumber);

if (!user) {
  user = await authModel.createCustomer(phoneNumber, fullName || 'Pelanggan MobilJuragan');
} else if (fullName && user.fullName !== fullName) {
  user = await authModel.updateFullName(user.id, fullName);   // <-- AKAR MASALAH
}
```

`mobiljuragan-backend/src/model/authModel.ts:29-35`

```ts
updateFullName(id: string, fullName: string) {
  return db.user.update({ where: { id }, data: { fullName } });
},
```

Cabang `else if` itu **tanpa syarat apa pun**: tidak butuh sesi, tidak butuh OTP terverifikasi, tidak butuh bukti kepemilikan nomor, tidak menulis audit, tidak memberi tahu pemilik lama.

### 4.2 Kontras yang membuktikan ini kelalaian, bukan desain

Jalur **staf/admin** justru sudah benar (`src/controller/adminUserController.ts:65-71`):

```ts
const existing = await userModel.findByPhoneNumber(phoneNumber);
if (existing) {
  throw new AppError('PHONE_NUMBER_EXISTS', 'Nomor telepon ini sudah terdaftar pada sistem.', 409);
}
```

Pola "tolak duplikat" sudah ada di codebase. Jalur pelanggan yang **tidak memakainya**.

### 4.3 Klien ikut memperbesar masalah

| Lokasi | Masalah |
|---|---|
| `mobiljuragan-mobile/lib/controllers/auth_controller.dart:316-340` | `updateProfile()` hanya mengubah state lokal + secure storage. **Tidak ada panggilan API.** Jadi edit profil tidak pernah sampai ke server; server hanya berubah lewat jalur OTP yang bug itu. |
| `.../auth_controller.dart:142-146` | `sendOtp()` mengirim `fullName` dari `_pendingRegistration` — nama yang diketik bebas di layar daftar. |
| `.../auth_controller.dart:184, 243` | Fallback **offline**: kode `123456` / `888888` / `1234` diterima **di sisi klien** tanpa server, lalu membuat user dengan id karangan `USR-MKQ-<timestamp>`. **Inilah asal akun inisial "PA".** |
| `.../auth_controller.dart:86-97` | `_saveSecureTokenAsync` menulis token palsu `secure_session_<timestamp>`; `hasValidToken()` hanya cek string tidak kosong, tidak pernah verifikasi JWT. → Akun hantu "selalu login" setiap aplikasi dibuka. |
| `.../auth_controller.dart:274-289` | `loginAsDefault()` (id `USR-MKQ-001`, nama "Pelanggan MobilJuragan") masih ada sebagai method publik, walau pemanggilnya sudah dihapus. Sisa fitur demo. |
| `.../auth_repository.dart:47` | `userId` jatuh ke nilai karangan kalau respons server tidak membawa `id`. |
| `.../auth_controller.dart:316-340` | `updateProfile` mengizinkan pembuatan `UserModel` baru walau belum ada sesi → profil tamu bisa berubah menjadi identitas karangan. |

Klien bisa menciptakan identitas yang **tidak pernah ada di server**, lalu menyimpan token/identitas itu di secure storage. Ketika sinkronisasi berjalan, kepemilikan data menjadi tidak konsisten.

### 4.4 Jalur pintas yang memperparah risiko

| Lokasi | Masalah |
|---|---|
| `authController.ts:86-100` | *Magic code* `123456` diterima ketika OTP tidak ditemukan — **asalkan user sudah ada**. |
| `authController.ts:133-135` | `verifyOtpHash(...)` atau `(isDev && otp === '123456')` — bypass di jalur normal. |
| `authController.ts:62-66` | Respons mengembalikan `devMockOtp` berisi kode asli saat `NODE_ENV !== 'production'`. |
| `rateLimiter.ts` | `loginRateLimiter` **hanya dipasang di `adminAuth.ts`**. `/auth/otp/request` dan `/auth/otp/verify` **tanpa rate limit**. |
| `model/authModel.ts:48-56` | OTP lama tidak di-revoke saat OTP baru diminta → beberapa kode valid bersamaan (terbukti 7 baris `consumedAt = NULL`). |
| `model/authModel.ts:58-63` | `attemptCount` per baris OTP, bukan per nomor → minta OTP baru = counter kembali 0. |
| `lib/auth.ts:79-83` | JWT berlaku **7 hari**, tanpa refresh token, tanpa `jti`, tanpa `tokenVersion` → token yang telanjur dicuri tetap sah seminggu, dan tidak bisa dicabut. |
| `routes/v1/auth.ts:17-21` | `purpose` hanya `z.string()` — tidak di-whitelist. |
| `lib/phone.ts:20-28` | Normalisasi `+62` / `62` / `0` benar, tetapi tidak ada validasi panjang per operator; tidak ada cek nomor tidak valid. |

### 4.5 Kenapa test tidak menangkap

- **Backend tidak punya test otentikasi sama sekali.** Tidak ada unit/integration test untuk `authController`/`authModel`. (`package.json` hanya menunjuk `../.verify/e2e` yang **tidak ada di repo ini**.)
- `mobiljuragan-mobile/test/repositories/auth_repository_test.dart` hanya menguji: sanitasi nomor, pemanggilan `requestOtp`, penyimpanan token, logout. **Tidak ada** skenario "nomor sudah terdaftar dengan nama berbeda".
- Tidak ada test yang mengunci perilaku: *registrasi ulang dengan nomor yang sudah ada harus ditolak*.

---

## 5. Apa yang Belum Ada dalam Sistem

Daftar ini adalah **kebutuhan**, bukan sekadar temuan. Kolom "standar industri" adalah pembanding yang lazim dipakai produk sejenis (Gojek, Traveloka, Grab, dan platform SaaS pada umumnya).

| # | Kebutuhan | Kondisi sekarang | Standar industri |
|---|---|---|---|
| 1 | Verifikasi sebelum menulis identitas | Menulis nama saat minta OTP | Data identitas hanya ditulis **setelah** OTP tervalidasi |
| 2 | Pemisahan niat *login* vs *daftar* | Satu endpoint untuk keduanya | `purpose`/`intent` terpisah; register & login punya alur sendiri |
| 3 | Status kepemilikan nomor | Tidak ada | `phoneVerifiedAt`; akun belum "sah" sebelum nomor terverifikasi |
| 4 | Penolakan nomor duplikat | Justru menimpa | `409 PHONE_ALREADY_REGISTERED` + arahkan ke login |
| 5 | Endpoint profil resmi | Tidak ada | `GET/PATCH /me` terautentikasi, nama = atribut yang bisa diubah pemiliknya |
| 6 | Audit perubahan identitas | Tidak ada | Append-only log: aktor, IP, user agent, nilai sebelum/sesudah |
| 7 | Rate limit OTP | Tidak ada | Per IP + per nomor + per device; cooldown kirim ulang 60 detik; kuota harian |
| 8 | OTP tunggal aktif | Banyak kode valid | Satu OTP aktif per (nomor, purpose); yang lama di-revoke |
| 9 | Counter percobaan per nomor | Per baris OTP | Persisten per nomor, tidak reset oleh permintaan baru |
| 10 | Pencabutan sesi | Tidak ada | `tokenVersion`/`jti` + refresh token; logout = cabut |
| 11 | Notifikasi perubahan akun | Tidak ada | WhatsApp/email ke pemilik saat identitas berubah |
| 12 | Konkurensi optimistik | Tidak ada | Cek `updatedAt`/`version` sebelum update (cegah overwrite bersamaan) |
| 13 | Anti-enumerasi nomor | Respons membocorkan keberadaan akun | Pesan seragam, tanpa membedakan "terdaftar"/"belum" |
| 14 | Jalur pintas hanya di lingkungan test | Magic code aktif di semua non-production, **plus** kode demo di klien (`123456`/`888888`/`1234`) | Bypass hanya saat `NODE_ENV === 'test'`, dan tidak pernah mengirim kode ke respons |
| 14a | Validasi sesi ke server | `hasValidToken()` hanya cek string | Setiap restore sesi diverifikasi (JWT/`/me`); token tidak sah = tamu |
| 14b | Identitas tidak boleh dibuat klien | id karangan `USR-MKQ-*` diterima | `id` hanya dari server; tidak ada id fallback di klien |
| 14c | Konsistensi klien–server | Riwayat lokal tanpa akun server tidak terlihat di dashboard | Data lokal wajib terikat `user_id` yang ada di server |
| 15 | Alat koreksi data untuk admin | Tidak ada | Dashboard audit + koreksi identitas dengan alasan wajib |
| 16 | Deteksi anomali | Tidak ada | Alert saat satu nomor berganti nama berkali-kali dalam waktu singkat |
| 17 | Kredensial kedua (kata sandi) | Tidak ada untuk pelanggan | Kata sandi ter-hash + OTP tetap tersedia (lihat §6.4) |
| 18 | Kebijakan kata sandi | Hanya `min(8)` untuk staff/admin | Policy bersama klien–server: panjang, kompleksitas, blokir kata sandi umum, batas 72 byte |
| 19 | Pemulihan kata sandi | Tidak ada | Reset lewat OTP ke nomor terverifikasi + pencabutan sesi |
| 20 | Umpan balik aturan kata sandi | Tidak ada | Checklist hidup saat mengetik (bukan pesan galat setelah kirim) |

---

## 6. Pilihan Solusi (beserta rekomendasi)

### 6.1 Model identitas — pilihan utama

**Opsi A — Nomor telepon sebagai identitas, nama sebagai atribut (rekomendasi)**

- `phoneNumber` = kunci identitas (tetap, `@unique`).
- `fullName` = atribut yang **hanya bisa diubah pemiliknya lewat `PATCH /me`** yang terautentikasi.
- Registrasi hanya membuat baris baru kalau nomor belum ada; kalau sudah ada → tolak dan arahkan login.

*Kelebihan:* perubahan kecil, cocok dengan data sekarang, tidak perlu migrasi besar.
*Kekurangan:* nomor berganti pemilik (nomor didaur ulang operator) tetap perlu proses khusus.

**Opsi B — Akun dengan ID internal + banyak kredensial**

- `users.id` adalah identitas; nomor telepon menjadi salah satu `user_credentials` (bisa lebih dari satu, punya status verifikasi sendiri).
- Nomor daur ulang bisa dilepas tanpa menghapus akun.

*Kelebihan:* paling benar untuk jangka panjang; mendukung login email/Google nanti.
*Kekurangan:* perlu tabel + migrasi + penyesuaian klien; bobot kerja jauh lebih besar.

**Rekomendasi:** **Opsi A sekarang**, dengan struktur data yang tidak menutup jalan ke Opsi B (mis. tambahkan `phoneVerifiedAt`, siapkan tabel `user_identities` bila nanti diperlukan).

### 6.2 Alur OTP — pisahkan tulis dari verifikasi

```
POST /auth/otp/request   → READ-ONLY terhadap users
   ├─ nomor belum ada + intent=REGISTER → kirim OTP (JANGAN buat user dulu)
   ├─ nomor sudah ada  + intent=LOGIN    → kirim OTP
   └─ nomor sudah ada  + intent=REGISTER → 409 PHONE_ALREADY_REGISTERED
                                           (jangan bocorkan nama pemilik)

POST /auth/otp/verify    → BARU menulis
   ├─ intent=LOGIN    → terbitkan token; tidak menyentuh fullName
   └─ intent=REGISTER → buat user (nama dari payload register yang tervalidasi),
                        set phoneVerifiedAt, terbitkan token

PATCH /me (auth)         → satu-satunya jalur ubah nama; wajib audit + notifikasi
```

Prinsip yang dipakai industri: **"never trust client-supplied identity before proof of possession"**. Nama boleh datang dari klien, tapi baru disimpan setelah bukti kepemilikan nomor diverifikasi.

### 6.3 Pengamanan tambahan yang wajib menyertai

| Area | Ketentuan |
|---|---|
| Rate limit | `/otp/request`: 3/menit per nomor, 10/jam per IP, cooldown 60 detik antar kirim. `/otp/verify`: 5 percobaan per nomor per 15 menit, dihitung **lintas permintaan** |
| OTP lifecycle | Satu OTP aktif per (nomor, purpose); minta baru = revoke yang lama; TTL 5 menit; `consumedAt` wajib |
| Token | `tokenVersion` di tabel user + klaim `ver` di JWT; naikkan versi saat logout-semua/ganti nomor; refresh token untuk sesi panjang |
| Audit | Tabel `identity_audit`: `userId`, `actorType` (SELF/ADMIN/SYSTEM), `actorId`, `field`, `before`, `after`, `ip`, `userAgent`, `reason`, `createdAt` — append-only |
| Notifikasi | WA/email ke nomor lama **dan** baru saat nama/nomor berubah |
| Anti-enumerasi | Respons seragam untuk nomor terdaftar/tidak; tanpa `devMockOtp` di luar `NODE_ENV==='test'` |
| Observability | Metrik: OTP request/menit per nomor, rasio gagal verify, jumlah perubahan nama per hari, alert bila > ambang |

---

### 6.4 Keputusan: Kata Sandi + OTP (Dua Jalur, Satu Identitas)

#### 6.4.1 Jawaban singkat atas pertanyaan

| Pertanyaan | Jawaban |
|---|---|
| Apakah pengguna memilih login dengan **kata sandi** atau **OTP**? | **Ya, pengguna memilih — tetapi bukan di layar pertama.** Layar pertama hanya meminta **nomor HP**. Setelah nomor diisi, baru muncul dua pilihan: *"Kirim kode OTP"* (utama) dan *"Masuk dengan kata sandi"* (alternatif). |
| Apakah perlu memasukkan **nama** lebih dulu untuk masuk ke opsi itu? | **Tidak, dan jangan pernah.** Nama **tidak boleh** diminta saat login. Nama adalah data yang **dibaca dari server**, bukan yang dikirim klien. Meminta nama saat login adalah **penyebab langsung** insiden "Harun → Yahya" (lihat §4.1). |
| Apakah nomor HP harus diisi lebih dulu? | **Ya.** Nomor HP tetap satu-satunya penanda identitas (§6.1 Opsi A). Kata sandi adalah **kredensial kedua** untuk identitas yang sama, bukan identitas baru. |

**Alasan memilih "nomor dulu, lalu pilih metode":**

1. Satu pintu masuk → tidak ada dua jalur yang harus dirawat terpisah di UI.
2. Nama tidak pernah dikirim klien → menutup seluruh kelas bug "nama menimpa akun".
3. OTP tetap jalur utama (sesuai perilaku aplikasi sekarang), kata sandi menjadi **jalan pintas** bagi pengguna yang sering login.
4. Metode dipilih setelah nomor diketahui, sehingga server bisa mengarahkan tanpa membocorkan status akun (lihat 6.4.4).

#### 6.4.2 Pembanding pola industri

| Produk | Layar pertama | Verifikasi | Kata sandi |
|---|---|---|---|
| Gojek, Grab, Traveloka (ID) | Nomor HP | OTP WhatsApp/SMS | Tidak ada (OTP murni) |
| Tokopedia, Shopee | Email/nomor | Kata sandi → OTP untuk aksi sensitif | Ada, OTP tetap dipakai untuk transaksi |
| Mobile banking | Username/nomor | Kata sandi/PIN → OTP transaksi | Ada, OTP wajib di lapisan kedua |
| SaaS (Slack, Notion) | Email | Kata sandi atau magic link | Ada, pengguna memilih |

**Pola yang dipakai proyek ini:** campuran Tokopedia + SaaS — **OTP untuk masuk pertama & pemulihan**, **kata sandi untuk masuk sehari-hari**, dan **OTP tetap menjadi lapisan kedua untuk hal sensitif**. Aksi sensitif di MobilJuragan (verifikasi dokumen lepas kunci, serah terima armada, verifikasi pembayaran) sudah dilindungi sesi + peran, jadi tidak perlu OTP tambahan per aksi.

#### 6.4.3 Alur daftar (final)

```
┌ Layar Daftar ────────────────────────────────────────────┐
│ Nama Lengkap (sesuai KTP)                                │
│ Nomor WhatsApp  (+62 …)                                  │
│ Kata Sandi            [👁]  ← checklist hidup di bawahnya │
│ Ulangi Kata Sandi     [👁]  ← indikator cocok/tidak      │
│ ☑ Saya menyetujui pernyataan data                        │
│                        [ Lanjut Verifikasi OTP → ]       │
└──────────────────────────────────────────────────────────┘
                    │
                    ▼  POST /auth/otp/request { phoneNumber, intent: REGISTER }
        (server TIDAK membuat baris users — hanya membuat OTP)
                    │
┌ Layar OTP ───────────────────────────────────────────────┐
│ 6 digit                                                  │
└──────────────────────────────────────────────────────────┘
                    │
                    ▼  POST /auth/register/verify
                       { phoneNumber, otp, fullName, password, gender? }
        server: verifikasi OTP → validasi kata sandi → bcrypt.hash
                → create user + phoneVerifiedAt → terbitkan token
                    │
                    ▼  Sesi aktif (dashboard sudah bisa melihat pelanggan)
```

**Mengapa kata sandi dikirim di langkah verifikasi, bukan di langkah permintaan OTP:**

| Alasan | Penjelasan |
|---|---|
| Tidak ada baris `users` sebelum verifikasi | Mempertahankan prinsip §6.2 "verifikasi dulu, baru tulis" |
| Kata sandi tidak pernah "menggantung" di server | Tidak ada kolom `pending_password` yang harus dienkripsi dan dibersihkan |
| Satu perjalanan jaringan | Tidak perlu `registrationToken` tambahan; sederhana untuk mobile |
| Gagal OTP = tidak ada efek samping | Tidak ada akun setengah jadi yang harus dibersihkan |

> **Alternatif bila kelak butuh multi-langkah** (mis. unggah KTP saat daftar): `verify` mengembalikan `registrationToken` berumur 10 menit, lalu `POST /auth/register` membawa token + nama + kata sandi. Sama-sama aman, tetapi menambah satu status yang harus kedaluwarsa. **Belum perlu sekarang.**

#### 6.4.4 Alur login (final)

```
┌ Layar Masuk ─────────────────────────────────────────────┐
│ Nomor WhatsApp  (+62 …)                                  │
│                                  [ Lanjut → ]            │
└──────────────────────────────────────────────────────────┘
                    │  (nomor belum dikirim ke mana pun)
                    ▼
┌ Pilih cara masuk ────────────────────────────────────────┐
│  Nomor: +62 812-xxxx-xxxx                                │
│                                                          │
│  [ Kirim Kode OTP ke WhatsApp ]        ← primer          │
│  [ Masuk dengan kata sandi ]           ← sekunder        │
│                                                          │
│  Belum punya akun? Daftar                                │
└──────────────────────────────────────────────────────────┘
        │                            │
        ▼                            ▼
  POST /auth/otp/request      POST /auth/login/password
  { phoneNumber, intent:LOGIN }   { phoneNumber, password }
        │                            │
        ▼                            ▼
   Layar OTP 6 digit          Langsung masuk
   POST /auth/otp/verify
```

**Keputusan penting:**

| # | Keputusan | Alasan |
|---|---|---|
| 1 | **Tidak ada field nama di layar login** | Nama adalah akibat, bukan syarat. Menutup §4.1. |
| 2 | **Dua tombol selalu ditampilkan**, bukan disembunyikan menurut "akun ini punya kata sandi atau tidak" | Kalau server hanya menampilkan opsi kata sandi untuk nomor terdaftar, penyerang bisa memetakan nomor mana yang punya akun. Jika pengguna memilih kata sandi padahal belum pernah membuatnya, jawabannya `PASSWORD_NOT_SET` + arahan memakai OTP. |
| 3 | **OTP tetap tersedia untuk semua akun** | Kalau pengguna lupa kata sandi, tidak perlu alur terpisah — cukup OTP. |
| 4 | **Salah kata sandi tidak mengunci jalur OTP**, tetapi **menambah counter yang sama** | Mencegah penyerang berganti-ganti metode untuk mereset hitungan (§6.7.4). |
| 5 | **Tidak ada "ingat saya" berbasis kata sandi tersimpan di perangkat** | Sesi disimpan sebagai token (sudah di secure storage), bukan kata sandi. |

#### 6.4.5 Lupa kata sandi

Karena nomor sudah terverifikasi, pemulihan tidak perlu email:

```
POST /auth/password/reset/request  { phoneNumber }          → kirim OTP (intent RESET)
POST /auth/password/reset/verify   { phoneNumber, otp, password }
   → server: verifikasi OTP → hash kata sandi baru
   → naikkan tokenVersion (semua sesi lama gugur)
```

Tambahan di halaman profil (sudah login):

```
PATCH /me/password { currentPassword?, newPassword }
   → bila passwordHash == null (akun lama), currentPassword tidak diwajibkan
   → naikkan tokenVersion, terbitkan token baru untuk perangkat ini
```

#### 6.4.6 Kontrak API (ringkas)

| Endpoint | Body | Sukses | Galat yang mungkin |
|---|---|---|---|
| `POST /auth/otp/request` | `phoneNumber`, `intent` | `200 { phoneNumber, expiresInSeconds }` | `OTP_RATE_LIMITED`, `PHONE_ALREADY_REGISTERED` (bila intent=REGISTER) |
| `POST /auth/register/verify` | `phoneNumber`, `otp`, `fullName`, `password`, `gender?` | `201 { token, user }` | `OTP_INVALID`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `PASSWORD_POLICY`, `PHONE_ALREADY_REGISTERED` |
| `POST /auth/otp/verify` | `phoneNumber`, `otp` (intent LOGIN) | `200 { token, user }` | `OTP_INVALID`, `OTP_EXPIRED`, `ACCOUNT_LOCKED` |
| `POST /auth/login/password` | `phoneNumber`, `password` | `200 { token, user }` | `INVALID_CREDENTIALS`, `PASSWORD_NOT_SET`, `ACCOUNT_LOCKED`, `ACCOUNT_INACTIVE` |
| `POST /auth/password/reset/request` | `phoneNumber` | `200` | `OTP_RATE_LIMITED` |
| `POST /auth/password/reset/verify` | `phoneNumber`, `otp`, `password` | `200 { token }` | `OTP_INVALID`, `PASSWORD_POLICY` |
| `PATCH /me/password` (auth) | `currentPassword?`, `newPassword` | `200` | `INVALID_CREDENTIALS`, `PASSWORD_POLICY` |

Konfirmasi kata sandi **hanya divalidasi di klien**; server cukup menerima satu `password`. Mengirim `confirmPassword` ke server menambah permukaan data sensitif tanpa manfaat.

**Mode tamu tidak berubah:** semua endpoint di atas hanya dipanggil saat pengguna **memilih** masuk atau mendaftar (§7b).

---

### 6.5 Kebijakan Kata Sandi

> **Revisi 9 November 2026.** Kebijakan dipersempit atas permintaan produk:
> aturan "kata sandi terlalu umum" dan "memuat nama/nomor sendiri" **dihapus**.
> Yang ditegakkan hanya **bentuk** kata sandi. Alasan penghapusan: kedua aturan
> itu menolak kata sandi yang sah tanpa alasan yang bisa diprediksi pengguna,
> dan pesannya cenderung disalahartikan sebagai bug ("kata sandi saya benar
> tapi ditolak"). Batas 72 byte **tetap** karena itu batas teknis bcrypt, bukan
> aturan gaya.

#### 6.5.1 Aturan yang dipakai

| # | Aturan | Pesan ke pengguna | Tampil sebagai checklist |
|---|---|---|---|
| 1 | Minimal **8 karakter** | "Minimal 8 karakter" | ya |
| 2 | Mengandung **huruf besar** (A–Z) | "Ada huruf besar" | ya |
| 3 | Mengandung **huruf kecil** (a–z) | "Ada huruf kecil" | ya |
| 4 | Mengandung **angka** (0–9) | "Ada angka" | ya |
| 5 | Mengandung **simbol** (selain huruf/angka) | "Ada simbol" | ya |
| 6 | Maksimal **72 byte** (UTF-8) | "Maksimal 72 byte" | tidak |

Aturan 1–5 adalah **permintaan produk**. Aturan 6 adalah pengaman teknis: bcrypt
memotong hash pada 72 byte, sehingga tanpa batas ini dua kata sandi berbeda bisa
dianggap sama.

**Yang sengaja tidak dipakai:**

| Aturan | Alasan tidak dipakai |
|---|---|
| Blokir kata sandi umum | Menolak kata sandi sah tanpa alasan yang bisa diprediksi; `Password123!` kini diterima |
| Blokir nama/nomor sendiri | Sama; `Yahya123!` kini diterima |
| Rotasi berkala | Ditolak NIST; menambah beban tanpa menaikkan keamanan nyata |
| Blokir tempel (*paste*) | Menghalangi pengelola kata sandi |

Konsekuensi yang perlu diterima: kekuatan kata sandi sepenuhnya bergantung pada
kesadaran pengguna. Pengaman yang tersisa ada di lapisan lain — pembatas
percobaan per nomor, penguncian akun, dan kode verifikasi untuk pemulihan.

#### 6.5.2 Catatan standar: jangan berhenti di "kompleksitas"

NIST SP 800-63B dan OWASP menyarankan **panjang** lebih menentukan daripada kombinasi karakter, serta **tidak** mewajibkan rotasi berkala. Checklist 1–5 tetap dipakai karena diminta, dengan penyesuaian agar tidak kontraproduktif:

| Praktik | Keputusan di proyek ini |
|---|---|
| Minimal 8 karakter | **Dipakai** (batas bawah NIST) |
| Wajib besar/kecil/angka/simbol | **Dipakai**, tetapi ditampilkan sebagai checklist hidup agar pengguna tidak menebak |
| Maksimal panjang | **72 byte**, bukan 8–16 (jangan memotong kemampuan *passphrase*) |
| Rotasi wajib tiap 90 hari | **Tidak dipakai** |
| Blokir kata sandi bocor | **Dipakai** (aturan 8) |
| Blokir tempel (*paste*) | **Tidak** — memblokir paste menghalangi pengelola kata sandi |
| Petunjuk keamanan (*hint*) | Hanya saat gagal, tidak pernah membocorkan bagian kata sandi |

**Rekomendasi tambahan yang murah:** izinkan **passphrase panjang** (`kucing-oren-lompat-pagi` = 24 karakter) dan beri nilai penuh walaupun tanpa simbol, **asalkan** panjangnya ≥ 16. Ini menaikkan keamanan nyata tanpa menambah beban ingatan.

---

### 6.6 Spesifikasi UI/UX — Checklist Hidup

#### 6.6.1 Token yang dipakai (sesuai design system yang ada)

| Kebutuhan | Token |
|---|---|
| Latar halaman | `AppColors.scaffoldBackground` (#F8FAFC) |
| Latar field | `AppColors.surfaceLight` (#F1F5F9) |
| Garis field | `AppColors.borderMedium` (#CBD5E1) |
| Garis saat fokus | `AppColors.primaryNavy` (#1E3A5F), lebar 1.5 |
| Radius field | 12 (sama dengan field daftar yang ada) |
| Ikon prefix | `AppColors.primaryTeal` (#0E7C7B), ukuran 20 |
| Teks utama | `AppColors.textPrimary` (#0F172A), 15/w600 |
| Hint | `AppColors.textMuted` (#94A3B8), `sizeBodyLarge` |
| Aturan **lulus** | `AppColors.tealDark` (#0D9488) + `Icons.check_circle_rounded` |
| Aturan **gagal** | `AppColors.statusCancelled` (#DC2626) + `Icons.cancel_rounded` |
| Aturan **belum** | `AppColors.textMuted` + `Icons.radio_button_unchecked` |
| Teks bantuan | `AppTypography.sizeTiny` (10) / `sizeCaption` (11), Inter |

Semua warna di atas **sudah ada** di `lib/theme/app_colors.dart`; tidak ada warna baru yang dikarang.

#### 6.6.2 Anatomi field kata sandi

```
Kata Sandi  *                         ← _buildFieldLabel() yang sudah ada
┌──────────────────────────────────┐
│ 🔒  ••••••••••••          👁     │  ← prefix lock + suffix toggle
└──────────────────────────────────┘
 ✓ Minimal 8 karakter    ✓ Ada angka
 ✓ Ada huruf besar       ✓ Ada simbol
 ✓ Ada huruf kecil
```

Aturan teknis:

| # | Ketentuan |
|---|---|
| 1 | `obscureText: true` + tombol tampil/sembunyikan (`Icons.visibility_outlined` ↔ `visibility_off_outlined`), target sentuh ≥44×44 |
| 2 | `autocorrect: false`, `enableSuggestions: false`, `textInputAction: TextInputAction.next` |
| 3 | `autofillHints: [AutofillHints.newPassword]` untuk daftar, `AutofillHints.password` untuk login — agar pengelola kata sandi bekerja |
| 4 | Checklist **muncul saat field difokuskan atau sudah ada isi**, tidak langsung saat layar dibuka |
| 5 | Tinggi area checklist **dipesan** (`SizedBox` minimum) supaya layout tidak melompat saat status berubah |
| 6 | Status dibedakan **ikon + teks**, bukan hanya warna (buta warna & mode gelap) |
| 7 | Checklist memakai `Wrap` dua kolom (lebar ≥360dp) atau satu kolom (lebih sempit) — jangan *card-in-card* (lihat `docs/login&buat&otp.md`) |
| 8 | Field konfirmasi punya indikator sendiri: "Kata sandi cocok" / "Belum cocok", dihitung saat mengetik |
| 9 | Tombol **Lanjut** nonaktif sampai aturan 1–5 lulus **dan** konfirmasi cocok |
| 10 | Papan ketik tidak menutupi checklist: `resizeToAvoidBottomInset` + `SingleChildScrollView` yang sudah dipakai layar daftar |
| 11 | `Semantics` untuk pembaca layar: `label: 'Kata sandi, wajib diisi'`, dan pengumuman saat aturan berubah |
| 12 | Tidak ada *strength meter* yang menakut-nakuti; bila dipakai, 4 segmen dengan token `borderSubtle → badgeAmberBg → tealMuted → tealDark` |

#### 6.6.3 Sumber kebenaran aturan: satu berkas

Agar klien dan server **tidak pernah berbeda pendapat** (penyebab umum galat "sudah valid di HP tapi ditolak server"):

| Tempat | Isi |
|---|---|
| `mobiljuragan-mobile/lib/core/validators/password_policy.dart` | Daftar aturan + `evaluate(String) → List<PasswordRule>` untuk checklist |
| `mobiljuragan-backend/src/lib/passwordPolicy.ts` | Aturan dan pesan yang sama; dipakai zod `refine` |
| Dokumen ini §6.5 | Rujukan tunggal bila salah satu berubah |

Checklist klien hanya untuk **umpan balik cepat**. Server tetap memvalidasi ulang; klien tidak pernah dianggap tepercaya.

---

### 6.7 Sisi Backend: Hashing & Penyimpanan

#### 6.7.1 Algoritma dan biaya

| Aspek | Keputusan |
|---|---|
| Algoritma | **bcrypt** (sudah tersedia di `src/lib/auth.ts` `hashPassword`) — konsisten dengan akun staff/admin |
| Biaya | **11** untuk kata sandi pelanggan (staff tetap 10). Dasar pengukuran: cost 10 = 128 ms, **11 = 244 ms**, 12 = 489 ms (rata-rata 3 percobaan). 489 ms terasa lambat di ponsel kelas bawah; 244 ms masih dua kali lebih berat dari akun staf. Naikkan bila server produksi lebih cepat — hash lama tetap sah karena biaya tersimpan di dalam nilainya |
| Alasan bukan argon2id | argon2id dinilai lebih baik oleh OWASP, tetapi menambah dependensi native; migrasi bisa menyusul dengan penanda `passwordAlgo` |
| Batas panjang | bcrypt **memotong pada 72 byte**. Karena itu aturan 6 (§6.5) wajib, atau lakukan *pre-hash* SHA-256 lalu bcrypt |
| Salt | Dibuat bcrypt (`genSalt`), tidak disimpan terpisah |
| Perbandingan | `bcrypt.compare` (constant-time di dalam pustaka); **jangan** membandingkan string hash |

#### 6.7.2 Tidak boleh keluar dari server

| Kanal | Pengamanan |
|---|---|
| Respons API | `userModel.PUBLIC_FIELDS` sudah mengecualikan `passwordHash`. Setiap query baru **wajib** memakai `select` itu, bukan `findUnique()` tanpa `select` |
| Log | `logger` sudah meredaksi `passwordHash`; **tambahkan** `req.body.password`, `req.body.newPassword`, `req.body.currentPassword` ke `redact` |
| Pesan galat | Tidak pernah menyebut "kata sandi salah untuk nomor X"; gunakan `INVALID_CREDENTIALS` |
| Audit log | Hanya mencatat **peristiwa** (`PASSWORD_CHANGED`, `PASSWORD_RESET`), tidak pernah nilainya |

#### 6.7.3 Anti-enumerasi dan waktu respons

Karena nomor HP adalah identitas, login kata sandi bisa dipakai memetakan siapa yang punya akun. Mitigasi:

1. Pesan galat **seragam**: nomor tidak dikenal, kata sandi salah, dan akun nonaktif → `INVALID_CREDENTIALS`.
2. **Tetap jalankan bcrypt** terhadap hash dummy bila nomor tidak ditemukan, supaya waktu respons tidak membocorkan keberadaan akun.
3. `PASSWORD_NOT_SET` hanya dijawab untuk akun yang **terbukti ada**; selain itu `INVALID_CREDENTIALS`.
4. Opsi kata sandi ditampilkan untuk **semua** nomor (§6.4.4 poin 2), sehingga tidak ada petunjuk visual.

#### 6.7.4 Penguncian akun yang **terpadu** (titik rawan galat baru)

`users.failedLoginAttempts` dan `users.lockedUntil` **sudah ada** dan dipakai `adminAuthController`. Untuk pelanggan, **semua** jalur kegagalan harus menambah counter yang sama:

| Jalur | Menambah `failedLoginAttempts` | Alasan |
|---|---|---|
| `POST /auth/login/password` salah | ✅ | Jalur utama |
| `POST /auth/otp/verify` salah | ✅ | Tanpa ini, penyerang beralih ke OTP dan counter tidak pernah naik |
| `POST /auth/password/reset/verify` salah | ✅ | Idem |
| Login/verifikasi berhasil | reset 0 + `lastLoginAt` | Sama seperti staff |
| Batas | 5 percobaan → kunci 15 menit (`LOGIN_MAX_ATTEMPTS`, `MENIT_KUNCI` yang sudah ada) | Konsisten dengan portal |

Tambahan **rate limit per IP dan per nomor** di lapisan rute (`express-rate-limit`), karena penguncian akun saja bisa dipakai menyerang pemilik akun (*denial of service*).

#### 6.7.5 Audit peristiwa identitas

Semua peristiwa kata sandi masuk ke `identity_audit` yang direncanakan di §7 Fase 2:

| `action` | Kapan |
|---|---|
| `PASSWORD_SET` | Kata sandi pertama kali dibuat (saat daftar, atau saat akun lama menambahkan) |
| `PASSWORD_CHANGED` | `PATCH /me/password` |
| `PASSWORD_RESET` | Setelah verifikasi OTP pemulihan |
| `PASSWORD_LOGIN_SUCCESS` / `PASSWORD_LOGIN_FAILED` | Tanpa menyimpan nilai, hanya hasil + IP + user agent |

---

### 6.8 Integrasi ke Rencana Sebelumnya (tanpa memunculkan galat baru)

#### 6.8.1 Perubahan pada tabel fase

| Fase | Tambahan akibat kata sandi | Ketergantungan |
|---|---|---|
| **Fase 0** (hotfix) | Tidak berubah | — |
| **Fase 1** | • `POST /auth/otp/request` berhenti menulis `users` (sudah dijadwalkan §7 Fase 1)<br>• `POST /auth/register/verify` (nama + kata sandi + OTP) — **menggantikan** "buat user saat verify"<br>• `passwordPolicy.ts` bersama + zod `refine`<br>• kolom `passwordHash` **dipakai** untuk pelanggan (kolom sudah ada, tanpa migrasi) | Harus **setelah** langkah "berhenti menulis di requestOtp", karena endpoint baru ini pengganti jalur tulis |
| **Fase 2** | • `POST /auth/login/password`, `POST /auth/password/reset/*`, `PATCH /me/password`<br>• penguncian akun **terpadu** (§6.7.4)<br>• `passwordUpdatedAt` (migrasi kecil)<br>• `identity_audit` untuk peristiwa kata sandi<br>• UI mobile: layar daftar + checklist, layar pilih-metode, layar masuk kata sandi | Harus **setelah** `identity_audit` dan `tokenVersion` ada, agar reset kata sandi bisa mencabut sesi lama |
| **Fase 3** | • Dashboard: status "punya kata sandi" per pelanggan, tombol kirim reset (opsional)<br>• Metrik: rasio login OTP vs kata sandi, jumlah reset | — |

#### 6.8.2 Urutan yang tidak boleh dibalik

```
1. Fase 0 hotfix            (berhenti menulis identitas sebelum verifikasi)
2. requestOtp tanpa write + register/verify   ← keduanya harus bersama
3. passwordPolicy bersama   (klien + server)
4. tokenVersion + identity_audit
5. login/password + reset + PATCH /me/password
6. UI mobile                (checklist, pilih metode, masuk kata sandi)
```

Membalik urutan 2 dan 5 (mis. menambah login kata sandi sebelum `register/verify` ada) akan membuat akun pelanggan **tidak punya** `passwordHash` sama sekali, sehingga fitur baru langsung mati saat diuji.

#### 6.8.3 Kompatibilitas data & pengguna lama

| Kondisi | Perlakuan |
|---|---|
| `passwordHash = NULL` (semua pelanggan sekarang, termasuk "Yahya"/"Harun") | Login kata sandi menjawab `PASSWORD_NOT_SET` → arahkan memakai OTP; setelah masuk, tawarkan "Buat kata sandi" di profil |
| Kolom `passwordHash` sudah dipakai staff/admin | **Tidak disentuh**; perbedaan peran tetap |
| Token lama (JWT 7 hari) | Tetap sah sampai kedaluwarsa; `tokenVersion` mulai berlaku saat ditambahkan — jangan memaksa logout semua orang di hari yang sama |
| Akun yang sudah terlanjur tertimpa | Ditangani §8, bukan oleh fitur kata sandi |

#### 6.8.4 Risiko regresi baru + mitigasi

| # | Risiko | Mitigasi |
|---|---|---|
| 1 | Kata sandi ikut tercatat di log | Tambahkan `redact` (§6.7.2) **sebelum** endpoint login dibuat |
| 2 | `passwordHash` ikut terkirim karena query baru tanpa `select` | Semua query pelanggan memakai `PUBLIC_FIELDS`; tambah test yang memeriksa respons tidak memuatnya |
| 3 | Penyerang memakai OTP untuk mereset counter kata sandi | Counter terpadu (§6.7.4) |
| 4 | Reset kata sandi tidak mencabut sesi lama | Naikkan `tokenVersion` di reset & `PATCH /me/password` |
| 5 | Daftar ulang nomor yang sudah punya kata sandi | `PHONE_ALREADY_REGISTERED` di `otp/request` (intent REGISTER) — sudah di Fase 0 |
| 6 | Checklist klien dan aturan server berbeda | Satu sumber aturan + test dengan kasus yang sama di dua sisi |
| 7 | bcrypt memotong kata sandi > 72 byte sehingga dua kata sandi berbeda dianggap sama | Aturan maksimum 72 byte **dan** test input 100 karakter |
| 8 | Penguncian akun dipakai menyerang pemilik nomor | Rate limit per IP + `ACCOUNT_LOCKED` dengan sisa waktu, tanpa membocorkan data lain |
| 9 | Kata sandi dikirim sebagai query string (bocor di log akses) | Hanya `POST` dengan body; larang `GET` |
| 10 | Mode tamu rusak karena layar login berubah | Test widget: tamu tetap bisa jelajah, baru diminta masuk saat mengirim pesanan |

#### 6.8.5 Tambahan matriks uji

| # | Kasus | Harapan |
|---|---|---|
| P1 | Daftar dengan kata sandi `abcdefgh` | Ditolak; checklist menandai 3 aturan belum lulus |
| P2 | Daftar dengan `Rahasia1!` | Diterima; tersimpan sebagai hash bcrypt, bukan plaintext |
| P3 | Konfirmasi berbeda | Tombol nonaktif; server tidak dipanggil |
| P4 | Kata sandi sama dengan nomor HP | Ditolak (aturan 7) |
| P5 | Kata sandi 100 karakter | Ditolak dengan pesan batas 72 byte |
| P6 | Daftar ulang nomor yang sudah ada | `409 PHONE_ALREADY_REGISTERED`, **tidak ada** perubahan pada `users` |
| P7 | Login kata sandi benar | Token terbit, `failedLoginAttempts = 0`, `lastLoginAt` terisi |
| P8 | Login kata sandi salah 5× | `ACCOUNT_LOCKED`, sisa waktu ditampilkan |
| P9 | 4× salah kata sandi lalu 1× OTP salah | Kunci aktif (counter **terpadu**) |
| P10 | Akun lama (`passwordHash = NULL`) login kata sandi | `PASSWORD_NOT_SET`, arahkan OTP; tanpa membocorkan data lain |
| P11 | Reset kata sandi | Sesi lain gugur (token lama → 401) |
| P12 | Respons API mana pun | Tidak pernah memuat `passwordHash` |
| P13 | Log server setelah login | Tidak memuat kata sandi |
| P14 | Tamu jelajah → kirim pesanan | Diminta masuk, bukan dibuatkan akun |

---

## 6b. Catatan Pelaksanaan

Bagian ini mencatat apa yang **sudah** dikerjakan supaya dokumen tetap menjadi
rujukan tunggal, bukan niat yang terpisah dari kenyataan.

### Fase 0 — selesai

| Butir | Bukti |
|---|---|
| `requestOtp` tidak lagi menulis `users` | Permintaan dengan `fullName` lain ke nomor terdaftar tidak mengubah nama |
| Nomor terdaftar + niat daftar ditolak | `409 PHONE_ALREADY_REGISTERED` |
| Magic code dikunci dua syarat | `ALLOW_DEV_OTP_BYPASS=false` → `123456` ditolak, `devMockOtp` hilang |
| Kode demo klien dihapus | `verifyOtp`/`verifyRegisterOtp` tidak lagi menerima kode tanpa server |
| Token palsu & id karangan dihapus | `secure_session_*` dan `USR-MKQ-*` tidak pernah dibuat |
| **Backdoor `requireAuth` ditutup** | Token `demo_jwt_token_`/`secure_session_` kini 401, tidak lagi membuat akun nomor tetap |
| Alat audit data | `npm run audit:identitas` → CSV di `backfill/` |

**Temuan tambahan di luar rencana awal:** `requireAuth` di backend menerima token
berawalan `demo_jwt_token_`/`secure_session_` lalu **membuat akun pelanggan
bernomor tetap** bila belum ada. Ini kembaran dari akun hantu "PA" di sisi mobile
dan tidak tercatat di analisis awal.

### Fase 1 — selesai

| Butir | Bukti |
|---|---|
| `users.phoneVerifiedAt`, `otp_verifications.userId` nullable, `phone_guards` | migrasi `20261108120000` |
| Satu kode aktif per (nomor, tujuan) | kode lama di-revoke saat kode baru diminta |
| Percobaan per nomor, bukan per baris OTP | 5 salah → kunci 15 menit, minta kode baru tidak mereset |
| `POST /auth/register/verify` | akun lahir setelah kode terbukti, `passwordHash` bcrypt biaya **11** |
| Kebijakan kata sandi bersama | `passwordPolicy.ts` + `password_policy.dart`, pesan identik |
| Checklist hidup di layar daftar | terverifikasi di emulator (5 aturan) |
| Aturan tersembunyi bekerja | `Emulator2026.` ditolak karena memuat kata dari nama |

**Koreksi terhadap rencana:** biaya bcrypt diturunkan dari **12 → 11** setelah
diukur (cost 10 = 128 ms, 11 = 244 ms, 12 = 489 ms).

### Fase 2 — selesai

| Butir | Bukti |
|---|---|
| `identity_audits` (append-only) | migrasi `20261108150000`; 3 baris tercatat untuk satu akun uji |
| `PATCH /me` + konkurensi optimistik | `expectedUpdatedAt` salah → `412 PROFILE_CONFLICT` |
| `users.tokenVersion` + klaim `ver` di JWT | ganti kata sandi → sesi lain `401 SESSION_REVOKED`, token baru tetap 200 |
| `POST /auth/login/password` | pesan seragam, bcrypt tiruan untuk nomor tak dikenal |
| `POST /auth/password/reset/*`, `PATCH /me/password` | reset lewat OTP berhasil; sandi lama tidak berlaku |
| Penguncian terpadu | 5× sandi salah → `ACCOUNT_LOCKED`, jalur OTP ikut terkunci |
| Notifikasi WhatsApp perubahan identitas | `whatsappOtpService.sendIdentityChanged` |
| Mobile: pilih cara masuk, login sandi, lupa sandi | terverifikasi di emulator |
| Mobile: ubah nama lewat server | `PATCH /me` dipanggil; `updateProfile` lokal dihapus |
| Mobile: menu "Kata Sandi Akun" | buat/ganti + checklist; nomor dibuat hanya-baca |

**Temuan tambahan Fase 2:** layar masuk masih memuat **prapengisian nomor
`812-4800-2910`** milik akun lain. Kelas masalah yang sama dengan pra-pengisian
nama "Harun" di layar daftar, dan sudah dihapus.

---
### Fase 3 — selesai

| Butir | Bukti |
|---|---|
| Alat audit di dashboard | `/identity-audit` menampilkan 22 peristiwa nyata dari database |
| Daftar akun pelanggan | `/customers` dengan filter "Perlu diperiksa" menandai akun Yahya |
| Koreksi nama oleh admin | `PATCH /admin/customers/:id/name`; alasan wajib ≥10 karakter |
| Koreksi tercatat | audit baru: `ADMIN Nama Tertimpa → Nama Sebenarnya` + alasan + IP |
| Idempoten | koreksi dengan nama sama menjawab "Nama tidak berubah", tanpa audit palsu |
| Buka kunci & cabut sesi | staf bisa menangani "akun saya terkunci" tanpa menunggu 15 menit |
| Usulan pemulihan | `npm run audit:pemulihan` → CSV berisi bukti per akun |
| Notifikasi pemilik | `sendIdentityChanged` juga dipanggil pada koreksi admin |

**Keputusan yang diambil:** nomor telepon **tidak** bisa diubah dari dashboard.
Mengganti nomor berarti mengganti identitas akun dan harus lewat verifikasi OTP
ke nomor baru, yang belum dibuat. Aturan ini menjaga arti "nomor = identitas".

### Yang sengaja belum dikerjakan

| Item | Alasan |
|---|---|
| Saklar debug build (`--dart-define`, `/dev/*` 404 di produksi) | Ditunda atas permintaan; rencananya ada di §7a |
| Ganti nomor telepon lewat verifikasi ganda | Butuh alur OTP ke nomor lama **dan** baru; belum ada kebutuhan nyata |
| Pemeriksaan kata sandi bocor (HIBP) | Daftar 10.000 kata sandi umum sudah menutup kasus paling nyata; k-anonymity menyusul bila perlu |
| Rotasi sesi berbasis refresh token | `tokenVersion` sudah memberi pencabutan; refresh token baru berguna bila umur akses diperpendek |

---
## 7. Rencana Kerja Bertahap

### Fase 0 — Hentikan pendarahan (target: hari ini, < 1 jam)

| # | Tindakan | Alasan |
|---|---|---|
| 0.1 | Hapus cabang `else if (fullName && ...) updateFullName(...)` di `requestOtp` | Menutup akar masalah |
| 0.2 | Bila nomor sudah ada dan niatnya registrasi → `409 PHONE_ALREADY_REGISTERED` | Cegah penimpaan sejak awal |
| 0.3 | Batasi magic code `123456` + `devMockOtp` hanya saat `NODE_ENV === 'test'` | Cegah bypass bila `NODE_ENV` lupa diisi di server |
| 0.4 | Tambahkan rate limit dasar pada `/auth/otp/request` dan `/auth/otp/verify` | Cegah brute force & spam |
| 0.5 | Catat nama asli akun yang sudah terlanjur tertimpa (dari booking/dokumen) untuk perbaikan manual | Bekukan kerusakan data |
| 0.6 | **Hapus fallback kode demo di klien** (`123456`/`888888`/`1234`) pada `verifyOtp` & `verifyRegisterOtp` | Sumber akun hantu inisial "PA" |
| 0.7 | **Hentikan penulisan token palsu** `secure_session_<timestamp>`; `_hasSecureToken` mengikuti `hasValidToken()` sebenarnya | Akun hantu tidak lagi "login otomatis" tiap buka app |
| 0.8 | **Hapus `loginAsDefault()`** (sisa fitur demo yang sudah tak dipanggil) | Menutup pintu masuk identitas karangan |
| 0.9 | **Tolak pembuatan identitas tanpa sesi** di `updateProfile` dan hapus id fallback `USR-MKQ-*` di `auth_repository` | Profil tamu tidak bisa melahirkan akun palsu |
| 0.10 | Kosongkan sesi lama di perangkat tim (logout paksa / `adb shell pm clear`) | "PA" menghilang dari emulator |

**Kriteria selesai:**
- permintaan OTP dengan nomor milik orang lain **tidak mengubah apa pun** di tabel `users`;
- tidak ada lagi akun yang bisa tampil login tanpa baris `users` yang sesuai di server.

> **Catatan penting:** `flutter clean` tidak cukup. Token palsu tersimpan di secure storage perangkat, jadi harus logout atau `pm clear` pada instalasi yang sudah terdampak.

### Fase 1 — Benahi alur (1–2 hari)

| # | Tindakan | Catatan |
|---|---|---|
| 1.1 | Tambah `purpose`/`intent` sebagai enum tervalidasi (`CUSTOMER_LOGIN`, `CUSTOMER_REGISTER`) | — |
| 1.2 | Pisahkan penulisan: buat user hanya di `verifyOtp` saat intent registrasi | — |
| 1.3 | Tambah kolom `phoneVerifiedAt` (+ migrasi) | — |
| 1.4 | Satu OTP aktif per (nomor, purpose); revoke OTP lama saat minta baru | — |
| 1.5 | Counter percobaan per nomor (tabel/kolom terpisah), bukan per baris OTP | — |
| 1.6 | Verifikasi sesi ke server saat `initSession()` (`GET /me`); token tidak sah → masuk mode tamu | — |
| 1.7 | Ganti `userId` karangan `USR-MKQ-...` menjadi kegagalan eksplisit bila server tidak mengirim id | — |
| 1.8 | `POST /auth/register/verify` — OTP + `fullName` + `password` dalam satu permintaan; akun baru dibuat di sini | — |
| 1.9 | `passwordPolicy.ts` di backend + `password_policy.dart` di mobile, isi aturan identik (§6.5) | — |
| 1.10 | Test: registrasi ulang nomor yang sudah ada **ditolak**; login tidak mengubah nama; kata sandi tersimpan sebagai hash | — |

### Fase 2 — Profil, audit, sesi (3–5 hari)

| # | Tindakan |
|---|---|
| 2.1 | Endpoint `GET /me` & `PATCH /me` (auth) — satu-satunya jalur ubah nama |
| 2.2 | Tabel `identity_audit` + pencatatan wajib untuk setiap perubahan identitas |
| 2.3 | `tokenVersion` di JWT + endpoint logout-semua |
| 2.4 | Notifikasi WA ke pemilik saat nama/nomor berubah |
| 2.5 | Mobile: `updateProfile()` benar-benar memanggil API + tangani konflik (`409`/`412`) |
| 2.6 | Konkurensi optimistik (`updatedAt` sebagai syarat update) |
| 2.7 | `POST /auth/login/password` + penguncian akun terpadu (§6.7.4) |
| 2.8 | `POST /auth/password/reset/request` & `/verify`, `PATCH /me/password`; naikkan `tokenVersion` |
| 2.9 | Migrasi `users.passwordUpdatedAt`; `PASSWORD_*` masuk `identity_audit` |
| 2.10 | Mobile: checklist kata sandi, layar "pilih cara masuk", layar masuk kata sandi, "buat kata sandi" di profil |
| 2.11 | `redact` log untuk `req.body.password`/`newPassword`/`currentPassword` |

### Fase 3 — Operasional & pemulihan (setelah Fase 2)

| # | Tindakan |
|---|---|
| 3.1 | Dashboard: halaman audit identitas + koreksi dengan alasan wajib |
| 3.2 | Skrip pemulihan data: rekonstruksi nama asli dari bukti (booking, dokumen, tiket), laporkan ke admin |
| 3.3 | Dashboard metrik & alert anomali |
| 3.4 | Prosedur tertulis: apa yang dilakukan bila ada laporan "akun saya berubah" |

---

## 7a. Kode OTP Pengembangan untuk Pengujian

Kode ajaib `123456` **masih tersedia**, tetapi sekarang dikunci dua syarat:

```ts
process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP_BYPASS === 'true'
```

Sebelumnya hanya syarat pertama. Artinya satu salah-setel `NODE_ENV` di server
cukup untuk membuka pintu masuk tanpa OTP — itulah yang ditutup pada Fase 0.

### Cara memakai

| Keperluan | Langkah |
|---|---|
| Menguji fitur buat akun | Isi form daftar (nama, nomor, kata sandi) → minta kode → masukkan `123456` |
| Menguji login | Masukkan nomor → minta kode → masukkan `123456` |
| Melihat kode asli | Respons `/auth/otp/request` memuat `devMockOtp` bila saklar aktif |

### Perilaku saat saklar diubah

Diuji langsung pada 8 November 2026:

| `ALLOW_DEV_OTP_BYPASS` | `devMockOtp` di respons | Verifikasi `123456` |
|---|---|---|
| `true` (sekarang) | ada | **diterima** |
| `false` / kosong | **hilang** | **ditolak** `OTP_INVALID` |
| `NODE_ENV=production` | hilang | ditolak |

### Aturan pemakaian yang disarankan

| # | Aturan |
|---|---|
| 1 | `ALLOW_DEV_OTP_BYPASS` **hanya** di `.env` lokal; `.env.example` sengaja kosong |
| 2 | Sebelum menyerahkan server ke pengguna sungguhan, pastikan nilainya kosong **dan** `NODE_ENV=production` |
| 3 | Kode asli tetap dibuat dan tetap dikirim ke WhatsApp; `123456` hanya jalan pintas verifikasi, bukan pengganti pembuatan kode |
| 4 | Batas percobaan per nomor tetap berlaku untuk kode salah, jadi pengujian dengan `123456` tidak mengunci akun |
| 5 | Bila perlu menguji "kode salah", gunakan nomor uji khusus agar nomor asli tidak terkena blokir 15 menit |

### Yang belum ada (kandidat Fase 3)

- Saklar terpisah khusus build debug aplikasi, supaya APK rilis tidak pernah
  menampilkan petunjuk kode uji.
- Perintah `npm run dev:otp-off` untuk mematikan saklar tanpa menyunting `.env`.

---
## 7b. Mode Tamu — Perilaku yang Dipertahankan

Aplikasi memang dirancang bisa dipakai **tanpa akun** sampai pelanggan hendak memesan. Ini perilaku yang benar dan **dipertahankan**:

| Tahap | Sebelum diperbaiki | Setelah diperbaiki |
|---|---|---|
| Buka aplikasi pertama kali | Tamu (`currentUser = null`, inisial "MJ") — **sudah benar** | Tetap tamu |
| Jelajah katalog, detail armada, FAQ | Tanpa akun | Tanpa akun |
| Mulai pesan (pilih tanggal/opsi) | Tanpa akun | Tanpa akun |
| Kirim pesanan | Wajib masuk (`_showLoginRequiredSheet` → login/OTP) | Tetap wajib masuk |
| Setelah OTP terverifikasi | Sesi diterbitkan server | Sama, tapi **hanya** lewat server |

Yang dihapus hanyalah **identitas karangan**: `loginAsDefault()`, kode demo klien, token palsu, dan id fallback `USR-MKQ-*`. Alur tamu tidak berubah.

**Konsekuensi yang perlu diterima:** bila server tidak dapat dihubungi, pelanggan **tidak bisa** masuk atau mendaftar. Dulu aplikasi "menolong" dengan mengarang akun, dan justru itu yang menciptakan akun hantu. Untuk aplikasi yang datanya harus ada di dashboard, gagal-terang lebih baik daripada berhasil-palsu.

**Yang perlu disiapkan menyusul (Fase 2):**
- Pesan galat yang jelas saat server tidak terjangkau ("periksa koneksi"), bukan "kode salah".
- Antrean pesanan luring yang **eksplisit** (status "belum terkirim", bisa dikirim ulang) alih-alih membuat kode pesanan karangan `MBJ-2026-*` yang tidak pernah sampai ke admin.
- Indikator di UI: "Anda menjelajah sebagai tamu".

---

## 8. Data yang Perlu Dipulihkan

Akun `081248002910` sekarang bernama "Yahya" padahal dibuat 27 Oktober. Yang perlu dilakukan **setelah** Fase 0:

1. Tentukan nama asli dari bukti yang tidak bisa dipalsukan: dokumen e-KTP/SIM, form kesanggupan, atau nama pada booking.
2. Kembalikan `fullName` dan catat tindakan di `identity_audit` dengan `actorType = SYSTEM`, `reason = 'pemulihan pasca-insiden'`.
3. Beri tahu pemilik nomor lewat WhatsApp bahwa namanya sempat berubah, dan minta konfirmasi.
4. Periksa apakah ada akun lain yang bernasib sama (cari baris `users` dengan `updatedAt` jauh setelah `createdAt` tetapi tidak punya audit log).

Kueri pembantu untuk audit awal:

```sql
-- kandidat akun yang namanya berubah tanpa jejak audit
SELECT u.id, u.fullName, u.phoneNumber, u.createdAt, u.updatedAt,
       TIMESTAMPDIFF(DAY, u.createdAt, u.updatedAt) AS umur_hari
FROM users u
WHERE u.role = 'CUSTOMER'
  AND u.updatedAt > DATE_ADD(u.createdAt, INTERVAL 1 DAY)
ORDER BY u.updatedAt DESC;
```

---

## 9. Keputusan yang Perlu Diambil Sebelum Implementasi

| # | Pertanyaan | Opsi |
|---|---|---|
| 1 | Model identitas jangka panjang | Opsi A (nomor = identitas) atau Opsi B (akun + banyak kredensial) |
| 2 | Nasib akun yang sudah tertimpa | Pulihkan nama asli / buat akun baru untuk pemilik nomor / gabungkan |
| 3 | Perlakuan APK lama | Wajib update (paksa) atau dukung fallback base64/offline sementara |
| 4 | Kebijakan magic code | Hapus total, atau pertahankan hanya untuk build debug internal |
| 5 | Nama saat registrasi | Wajib cocok dengan e-KTP, atau bebas diisi lalu diverifikasi saat verifikasi dokumen |
| 6 | Kata sandi wajib saat daftar, atau opsional? | **Rekomendasi: wajib** saat daftar (checklist memandu), dengan OTP tetap sebagai verifikasi nomor |
| 7 | Akun lama tanpa kata sandi | Dibolehkan tetap OTP; tawarkan "Buat kata sandi" setelah masuk, jangan paksa di hari yang sama |
| 8 | Biaya bcrypt | **Sudah diputuskan: 11** untuk pelanggan (terukur 244 ms); staff tetap 10 |
| 9 | Kebijakan penguncian | 5 percobaan → 15 menit, **terpadu** untuk semua jalur (§6.7.4) |

---

## 10. Anti-pola yang Harus Dihindari

- **Menambal di klien saja** (mis. menyembunyikan kolom nama saat nomor sudah dipakai). Server tetap dapat dipanggil langsung.
- **Menambah `if` di dalam `else if` yang sama** tanpa memisahkan niat login/daftar — masalah akan muncul lagi lewat jalur lain.
- **Mengandalkan `NODE_ENV`** sebagai satu-satunya pemisah magic code tanpa default aman.
- **Menghapus kolom `fullName`** untuk "menyelesaikan" masalah — data itu dibutuhkan pada kontrak dan verifikasi dokumen.
- **Menambah rate limit tanpa menyatukan counter percobaan** — penyerang cukup meminta OTP baru untuk mereset hitungan.
- **Meminta nama di layar login** untuk "mencocokkan akun" — inilah asal insiden ini.
- **Menghash kata sandi di klien** lalu mengirim hashnya — hash menjadi kata sandi; server tetap harus menghash.
- **Menyimpan kata sandi sementara di server** sebelum OTP terverifikasi (kolom `pending_password`).
- **Checklist di klien saja** tanpa validasi server, atau aturannya ditulis dua kali dengan isi berbeda.
- **Membatasi panjang maksimal 16 karakter** — memotong kemampuan *passphrase*.
- **Memaksa rotasi kata sandi berkala** — dianjurkan untuk ditinggalkan (NIST).
- **Menonaktifkan tempel (*paste*)** pada kolom kata sandi — menghalangi pengelola kata sandi.
- **Menampilkan "nomor belum terdaftar"** pada login kata sandi — membocorkan daftar pelanggan.

---

## 11. Lampiran — Peta Lokasi Kode

| Berkas | Peran dalam insiden |
|---|---|
| `mobiljuragan-backend/src/controller/authController.ts:21-32` | **Akar masalah**: `updateFullName` dipanggil sebelum verifikasi |
| `mobiljuragan-backend/src/model/authModel.ts:29-35` | Operasi `user.update` tanpa audit |
| `mobiljuragan-backend/src/model/authModel.ts:48-63` | OTP tidak di-revoke; counter per baris |
| `mobiljuragan-backend/src/controller/authController.ts:62-66` | `devMockOtp` dikirim di respons |
| `mobiljuragan-backend/src/controller/authController.ts:86-100,133-135` | Magic code `123456` |
| `mobiljuragan-backend/src/routes/v1/auth.ts:17-21` | `purpose` tidak di-whitelist |
| `mobiljuragan-backend/src/routes/v1/adminAuth.ts:29-36` | Contoh rate limit yang benar (hanya admin) |
| `mobiljuragan-backend/src/controller/adminUserController.ts:65-71` | Contoh penolakan duplikat yang benar (staf/admin) |
| `mobiljuragan-backend/src/lib/auth.ts:79-83` | JWT 7 hari tanpa pencabutan |
| `mobiljuragan-mobile/lib/controllers/auth_controller.dart:142-146` | Nama dikirim saat minta OTP |
| `mobiljuragan-mobile/lib/controllers/auth_controller.dart:184, 243` | Login offline dengan kode demo → akun hantu "PA" |
| `mobiljuragan-mobile/lib/controllers/auth_controller.dart:86-97` | Penulisan token palsu `secure_session_*` |
| `mobiljuragan-mobile/lib/controllers/auth_controller.dart:274-289` | `loginAsDefault()` — akun demo hardcoded |
| `mobiljuragan-mobile/lib/controllers/auth_controller.dart:316-340` | `updateProfile` bisa membuat identitas tanpa sesi |
| `mobiljuragan-mobile/lib/controllers/auth_controller.dart:316-340` | `updateProfile` lokal, tanpa API |
| `mobiljuragan-mobile/lib/data/repositories/auth_repository.dart:47` | `userId` karangan bila server tidak mengirim id |
| `mobiljuragan-mobile/test/repositories/auth_repository_test.dart` | Test yang ada — tidak mencakup skenario ini |
| `mobiljuragan-backend/src/lib/auth.ts:62-73` | `hashPassword` / `verifyPassword` (bcrypt) yang sudah ada — dipakai ulang untuk pelanggan |
| `mobiljuragan-backend/src/controller/adminAuthController.ts:22, 86-126` | Pola penguncian akun (`BATAS_PERCOBAAN`, `MENIT_KUNCI`, reset counter) yang tinggal dipakai bersama |
| `mobiljuragan-backend/prisma/schema.prisma:130-142` | `passwordHash`, `failedLoginAttempts`, `lockedUntil`, `lastLoginAt` — sudah ada, tanpa migrasi |
| `mobiljuragan-backend/src/model/userModel.ts:11-19` | `PUBLIC_FIELDS` — daftar kolom aman; `passwordHash` sengaja tidak ikut |
| `mobiljuragan-backend/src/logger.ts:6-12` | `redact` yang perlu ditambah `req.body.password` |
| `mobiljuragan-backend/src/controller/adminUserController.ts:17-32` | Contoh validasi zod kata sandi (masih `min(8)` saja) |
| `mobiljuragan-mobile/lib/screens/auth/register_screen.dart:227-285` | Pola `_buildFieldLabel` + dekorasi field yang harus diikuti layar kata sandi |
| `mobiljuragan-mobile/lib/theme/app_colors.dart`, `app_typography.dart` | Token warna & ukuran yang dipakai checklist (§6.6.1) |

---

## 12. Kesimpulan

Masalahnya bukan pada satu baris `if` yang lupa ditulis. Masalahnya adalah **tidak adanya model identitas**:

- nomor telepon dipakai sebagai identitas **dan** kredensial sekaligus,
- data identitas ditulis **sebelum** kepemilikan nomor dibuktikan,
- perubahan identitas **tidak diaudit**, **tidak diberitahukan**, dan **tidak bisa dicabut**,
- tidak ada jalur resmi bagi pemilik akun untuk mengubah datanya sendiri.

Masalah ini punya dua wajah yang berakar sama:

1. **Di server** — identitas ditulis sebelum kepemilikan nomor dibuktikan (nama pelanggan bisa ditimpa).
2. **Di klien** — identitas boleh dikarang sendiri (akun hantu dengan inisial "PA", token palsu, id `USR-MKQ-*`).

Keduanya berujung sama: **ada akun yang tampil di aplikasi tetapi tidak dikenal database**. Dengan kata sandi ditambahkan, ada **lapisan ketiga** yang harus dijaga: kredensial. Karena itu kata sandi tidak boleh diperlakukan sebagai "tombol masuk tambahan", melainkan:

- **kredensial kedua untuk identitas yang sama** — nomor HP tetap identitas, kata sandi hanya cara membuktikannya;
- **terikat pada verifikasi nomor** — kata sandi hanya bisa dibuat setelah OTP membuktikan kepemilikan nomor;
- **tidak pernah menjadi jalan pintas menulis data identitas** — login kata sandi tidak boleh mengubah `fullName`;
- **memakai mekanisme yang sudah ada** — bcrypt, `failedLoginAttempts`, `lockedUntil`, `PUBLIC_FIELDS`, penguncian portal — supaya tidak lahir dua sistem keamanan yang berbeda perilaku.

Selama empat hal di bawah belum ada, memperbaiki `else if` hari ini hanya memindahkan lubang ke tempat lain. Urutan yang benar: **tutup akar masalah (Fase 0) → benahi alur & OTP (Fase 1) → bangun profil, audit, dan sesi (Fase 2) → pulihkan data & alat operasional (Fase 3)**.
