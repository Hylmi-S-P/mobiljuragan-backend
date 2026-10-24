# Cetak Biru Arsitektur: Sistem CRUD Balasan Cepat (Canned Responses)

**Target Modul:** Customer Care / Support Tiket (`backend` & `frontend`)  
**Status:** Rekomendasi & Blueprint Siap Implementasi (Paket 3)  
**Tujuan:** Menggantikan tombol balasan cepat statis di JSX menjadi entitas dinamis yang dapat dikelola secara mandiri oleh tim admin/staf support tanpa perlu rilis kode baru.

---

## 1. Latar Belakang & Analisis Urgensi

Saat ini, template balasan cepat pada antarmuka admin Customer Care (`frontend/components/support/TicketWorkspace.tsx`) masih bersifat **hardcoded statis** di dalam kode JSX:
- Tombol `+ Unit Tersedia`
- Tombol `+ Rekening Resmi` (Bank BRI 0321-01-002847-53-1 an MobilJuragan Merauke)
- Tombol `+ Konfirmasi Supir`

### Kelemahan Pendekatan Hardcoded:
1. **Risiko Operasional & Human Error:** Jika rekening resmi bank mengalami perubahan, terjadi promo tarif sewa, atau penyesuaian SOP penjemputan bandara Mopah Merauke, staf admin tidak bisa mengubah teks template sendiri. Mereka harus meminta developer mengubah file `.tsx` dan melakukan build/deploy frontend.
2. **Keterbatasan Variasi Respon:** Staf hanya memiliki 3 template statis, padahal kategori tiket mencakup General, Pembayaran, Masalah Armada, Pembatalan, dan Keluhan Sopir.
3. **Ketiadaan Fleksibilitas Hak Akses:** Tidak ada audit trail siapa staf yang memperbarui pesan template resmi perusahaan.

**Kesimpulan:** Sistem CRUD Canned Responses sangat direkomendasikan untuk segera dibangun guna mendukung operasional harian customer care.

---

## 2. Usulan Skema Database (Prisma ORM)

Tambahkan model `CannedResponse` pada `backend/prisma/schema.prisma`:

```prisma
/// Template balasan cepat resmi customer support MobilJuragan
model CannedResponse {
  id          String   @id @default(uuid())
  shortcut    String   @unique // Misal: "!rekening", "!armada-siap", "!sopir"
  title       String   // Label tombol pada UI, misal: "Rekening Resmi BRI"
  content     String   @db.Text // Isi template balasan lengkap
  category    TicketCategory @default(GENERAL) // GENERAL | PAYMENT_CONFIRMATION | VEHICLE_ISSUE | CANCELLATION | COMPLAINT | OTHER
  orderIndex  Int      @default(0) // Urutan tampilan tombol di UI
  isActive    Boolean  @default(true) // Sakelar aktif/nonaktif
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category])
  @@index([isActive])
  @@index([orderIndex])
  @@map("canned_responses")
}
```

### Data Awal (Seed Default):
```json
[
  {
    "shortcut": "!rekening",
    "title": "Rekening Resmi",
    "content": "Silakan lakukan transfer pelunasan ke rekening resmi Bank BRI 0321-01-002847-53-1 an MobilJuragan Merauke.",
    "category": "PAYMENT_CONFIRMATION",
    "orderIndex": 1,
    "isActive": true
  },
  {
    "shortcut": "!unit",
    "title": "Unit Tersedia",
    "content": "Halo, armada yang Anda tanyakan tersedia dan siap digunakan sesuai jadwal.",
    "category": "GENERAL",
    "orderIndex": 2,
    "isActive": true
  },
  {
    "shortcut": "!sopir",
    "title": "Konfirmasi Supir",
    "content": "Supir resmi kami telah ditugaskan dan akan segera menghubungi nomor Anda sebelum jadwal penjemputan.",
    "category": "COMPLAINT",
    "orderIndex": 3,
    "isActive": true
  }
]
```

---

## 3. Spesifikasi REST API Backend

Seluruh endpoint dipasang di bawah router admin `/api/v1/admin/canned-responses` dengan proteksi `requireAuth` dan `requireRole(UserRole.ADMIN, UserRole.STAFF)`.

### 1. Daftar Balasan Cepat
- **Metode & URL:** `GET /api/v1/admin/canned-responses`
- **Query Params:**
  - `category` (opsional): filter kategori tiket
  - `includeInactive` (opsional, boolean): jika `true`, sertakan template nonaktif
- **Format Respons:**
  ```json
  {
    "status": "ok",
    "success": true,
    "data": [
      {
        "id": "uuid-1",
        "shortcut": "!rekening",
        "title": "Rekening Resmi",
        "content": "Silakan lakukan transfer pelunasan ke rekening resmi Bank BRI 0321-01-002847-53-1 an MobilJuragan Merauke.",
        "category": "PAYMENT_CONFIRMATION",
        "orderIndex": 1,
        "isActive": true
      }
    ]
  }
  ```

### 2. Tambah Balasan Cepat
- **Metode & URL:** `POST /api/v1/admin/canned-responses`
- **Payload Request:**
  ```json
  {
    "shortcut": "!dp50",
    "title": "Ketentuan DP 50%",
    "content": "Pemesanan armada luar kota Merauke mewajibkan uang muka sebesar minimal 50% dari total sewa.",
    "category": "PAYMENT_CONFIRMATION",
    "orderIndex": 4
  }
  ```

### 3. Perbarui Balasan Cepat
- **Metode & URL:** `PUT /api/v1/admin/canned-responses/:id` atau `PATCH /api/v1/admin/canned-responses/:id`
- **Payload Request:** Partial update (`title`, `content`, `category`, `orderIndex`, `isActive`).

### 4. Hapus Balasan Cepat
- **Metode & URL:** `DELETE /api/v1/admin/canned-responses/:id`
- **Tindakan:** Soft-delete (`isActive = false`) atau permanent delete jika belum pernah terikat audit pesan.

---

## 4. Rencana Integrasi UI di Frontend (`TicketWorkspace.tsx`)

1. **Pemanggilan Data di Server Component (`app/(dashboard)/customer-care/page.tsx`):**
   ```tsx
   const [tickets, cannedResponses] = await Promise.all([
     getSupportTickets(),
     getCannedResponses(),
   ]);
   ```
2. **Dynamic Chips Rendering:**
   Alih-alih menulis tombol JSX statis, loop data dari props `cannedResponses`:
   ```tsx
   {cannedResponses
     .filter((cr) => cr.isActive && (!activeTicket || cr.category === activeTicket.category || cr.category === "GENERAL"))
     .map((cr) => (
       <button
         key={cr.id}
         type="button"
         disabled={isHandledByAi}
         onClick={() => setDraft(cr.content)}
         className="rounded-xs border border-rule bg-canvas px-2 py-0.5 text-micro font-medium text-ink hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
       >
         + {cr.title}
       </button>
     ))}
   ```
3. **Fitur Pengelolaan Balasan Cepat:**
   Tambahkan tombol bergambar gerigi / tautan `"Kelola Template"` di samping label `Balasan Cepat:`. Mengklik tombol ini akan membuka modal sederhana untuk:
   - Menambah template baru.
   - Mengedit isi teks atau mengubah status aktif.
   - Mengurutkan urutan tombol di antarmuka chat.
