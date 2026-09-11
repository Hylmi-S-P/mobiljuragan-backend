---
tanggal: 10/09/26
milestone: M-Freeze (non-roadmap, keputusan pivot tim)
fitur: Usulan pivot - backend freeze di M5, rollback ke lo-fi (menunggu ACC)
pic: Hylmi (PIC C - Backend Engineer)
reviewer: Halimah (PIC D - QA) - reviewer utama per rotasi
status: planned (menunggu ACC tim)
model_ai: reasonix (agent) / model dinamis
provider_ai: reasonix
cakupan_ai: docs
---

## 1. Ringkasan

Tindak lanjut: tim mengusulkan rollback ke lo-fi wireframe untuk mematangkan gambaran
prototype sebelum lanjut hi-fi. Usulan backend freeze di M5 juga diajukan. M3-M5
diusulkan tetap dipakai sebagai fondasi, bukan discrap. Entry ini berstatus `planned`
karena menunggu ACC tim; detail keputusan final akan diperbarui setelah verifikasi.

## 2. Keputusan

- M3-M5 tetap dipakai sebagai fondasi backend dan kontrak API.
- M6+ ditunda sampai hi-fi flow final disetujui oleh tim.
- Tidak ada endpoint backend baru selama periode freeze.

## 3. Endpoint yang sudah tersedia dan dipakai hi-fi

- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/admin/auth/login`
- `GET /api/v1/admin/auth/me`

## 4. Endpoint yang belum tersedia

Endpoint berikut akan dibangun setelah hi-fi final disetujui, sesuai roadmap:

- `GET /api/v1/vehicles`
- `GET /api/v1/vehicles/:id`
- `POST /api/v1/bookings`
- `GET /api/v1/bookings/:id`
- Endpoint lanjutan lain sesuai roadmap M6+.

## 5. Dampak ke OpenAPI spec

`docs/api/openapi.yaml` tetap menjadi acuan kontrak dan single source of truth. Jika hi-fi
mengubah flow, revisi dilakukan pada spec terlebih dahulu, bukan langsung pada kode.

## 6. Catatan PIC C

PIC C tidak menambah endpoint baru sampai tim menyetujui hi-fi flow final. PIC A dan PIC B
perlu memeriksa desain terlebih dahulu.

## 7. Checklist reviewer

- [ ] Halimah memverifikasi dan menyetujui pivot rollback ke lo-fi serta backend freeze di M5.
- [ ] Setelah verifikasi, checklist ditandai [x] dan status entry dapat diperbarui sesuai
  keputusan tim.
