# Laporan Keamanan Teknis: Kerentanan Bypass Pembayaran Sepihak di Aplikasi Mobile (Client-Side State Mutation)

**Tingkat Keparahan:** KRITIS (Critical - CVSS 9.1)  
**Komponen Terdampak:** Aplikasi Mobile Flutter (`mobile/`)  
**Status Penanganan:** Dokumentasi Analisis & Panduan Remediasi untuk Tim Pengembang Mobile  

---

## 1. Ringkasan Eksekutif

Ditemukan celah keamanan kritis pada aplikasi mobile MobilJuragan yang memungkinkan pelanggan melunaskan pesanan sewa mobil secara sepihak tanpa melakukan transfer dana nyata dan tanpa validasi dari server backend. Celah ini timbul karena antarmuka chat bantuan pelanggan (`ChatSupportScreen`) memiliki tombol aksi yang langsung mengubah status pesanan pada basis data lokal perangkat (SQLite) menjadi `mobilSiapDigunakan` dan menerbitkan E-Ticket resmi tanpa memverifikasi mutasi bank atau status pembayaran di REST API backend.

---

## 2. Lokasi Kerentanan pada Kode Sumber

Kerentanan berpusat pada pemanggilan fungsi mutasi status lokal dari widget percakapan:

### A. Tombol Aksi Pesan Menunggu Pembayaran
- **Berkas:** `mobile/lib/screens/chat_support_screen.dart`
- **Baris:** 430–450
- **Kode:**
  ```dart
  ElevatedButton(
    onPressed: () {
      support.confirmPaymentFromChat(
        booking: booking,
        onAdvance: () {
          bookingCtrl.confirmPaymentAndAdvance(booking.id);
        },
      );

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF15803D),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          content: Text(
            'Pembayaran #${booking.id} berhasil diverifikasi! Unit siap digunakan.',
            style: const TextStyle(fontFamily: 'Inter', fontSize: AppTypography.sizeBody),
          ),
        ),
      );
      _scrollToBottom();
    },
    ...
  )
  ```

### B. Tombol Cepat Saran Balasan (Quick Suggestion Chip)
- **Berkas:** `mobile/lib/screens/chat_support_screen.dart`
- **Baris:** 735–745
- **Kode:**
  ```dart
  if (suggestion == 'Konfirmasi Sudah Bayar' && booking != null) {
    controller.confirmPaymentFromChat(
      booking: booking,
      onAdvance: () {
        bookingCtrl.confirmPaymentAndAdvance(booking.id);
      },
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF15803D),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        content: Text(
          'Pembayaran #${booking.id} berhasil diverifikasi! Unit siap digunakan.',
          style: const TextStyle(fontFamily: 'Inter', fontSize: AppTypography.sizeBody),
        ),
      ),
    );
  }
  ```

### C. Mutasi Status Lokal Tanpa Otorisasi Server
- **Berkas:** `mobile/lib/controllers/booking_controller.dart`
- **Baris:** 277–307
- **Kode:**
  ```dart
  void confirmPaymentAndAdvance(String bookingId) {
    completeOnlinePayment(
      bookingId: bookingId,
      paymentMethod: PaymentMethodType.qrisOtomatis,
    );
  }

  void completeOnlinePayment({
    required String bookingId,
    required PaymentMethodType paymentMethod,
    String? referenceCode,
  }) {
    final index = _bookingHistory.indexWhere((b) => b.id == bookingId);
    if (index != -1) {
      final ref = referenceCode ??
          'TRX-MBJ-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
      final updated = _bookingHistory[index].copyWith(
        paymentMethodType: paymentMethod,
        status: BookingStatus.mobilSiapDigunakan,
        paidAt: DateTime.now(),
        paymentReference: ref,
      );
      _bookingHistory[index] = updated;
      if (_activeBooking?.id == bookingId) {
        _activeBooking = updated;
      }
      repository?.saveBooking(updated); // Disimpan permanen ke SQLite lokal!
      notifyListeners();
    }
  }
  ```

---

## 3. Alur Eksploitasi (Proof of Concept)

1. **Pembuatan Pesanan:** Pelanggan memesan mobil (misal Toyota Fortuner GR Sport senilai Rp 1.500.000/hari) melalui aplikasi mobile. Pesanan tercatat di backend dengan status `CREATED` atau `CONFIRMED` dan pembayaran belum lunas (`UNPAID`).
2. **Membuka Layanan Pelanggan:** Pelanggan masuk ke menu Chat Bantuan (`ChatSupportScreen`).
3. **Pemicu Tombol Bypass:**
   - Pelanggan melihat banner pesanan menunggu pembayaran lalu menekan tombol hijau verifikasi, ATAU
   - Pelanggan memilih quick suggestion chip *"Konfirmasi Sudah Bayar"*.
4. **Mutasi Sepihak:**
   - Aplikasi mobile secara instan mengeksekusi `confirmPaymentAndAdvance()`.
   - Kode referensi acak fiktif `TRX-MBJ-XXXXXXX` dibuat secara lokal.
   - Status pesanan dalam penyimpanan SQLite lokal perangkat langsung berubah menjadi `BookingStatus.mobilSiapDigunakan`.
   - Layanan menampilkan SnackBar hijau resmi: *"Pembayaran #... berhasil diverifikasi! Unit siap digunakan."*
5. **Penerbitan E-Ticket Tanpa Dana:**
   - Layanan status pesanan di mobile kini menampilkan unit siap diambil lengkap dengan barcode/E-Ticket.
   - Pelanggan dapat menunjukkan tiket tersebut kepada staf operasional di garasi/bandara tanpa pernah mentransfer dana satu rupiah pun.
   - Pada database backend, pesanan tetap berstatus `UNPAID` dan rekening perusahaan tidak menerima mutasi.

---

## 4. Dampak Bisnis & Operasional

1. **Kerugian Finansial Langsung:** Risiko kehilangan unit rental atau penggunaan armada tanpa kompensasi finansial nyata.
2. **Inkonsistensi Data (Split-Brain State):** Status operasional di aplikasi ponsel pelanggan (`mobilSiapDigunakan`) bertolak belakang dengan database pusat backend (`UNPAID`).
3. **Kegagalan Audit Keuangan:** Hilangnya jejak audit pembayaran sah (payment lifecycle audit log) yang seharusnya melibatkan verifikasi mutasi bank resmi atau notifikasi otomatis dari payment gateway.
4. **Kerentanan Sosial Staf Operasional:** Staf lapangan di Merauke yang hanya mengandalkan inspeksi visual layar ponsel pelanggan rentan tertipu oleh tampilan E-Ticket yang dihasilkan secara lokal.

---

## 5. Petunjuk Langkah Perbaikan Konkret (Panduan Tim Mobile Dev)

Tim mobile diminta untuk mengimplementasikan prinsip **Server-Authoritative State**:

### Langkah 1: Cabut Mutasi Status Langsung dari UI Percakapan
- Hapus pemanggilan `bookingCtrl.confirmPaymentAndAdvance(booking.id)` dari baris 430–450 dan 735–745 di `mobile/lib/screens/chat_support_screen.dart`.
- Ubah tombol *"Konfirmasi Sudah Bayar"* agar mengarahkan pelanggan ke layar unggah bukti transfer resmi (`uploadPaymentProof`) atau mengirimkan pesan teks konfirmasi ke admin/staf support, BUKAN melunaskan pesanan secara otomatis.

### Langkah 2: Batasi Fungsi `completeOnlinePayment` Hanya untuk Callback Server Terverifikasi
- Fungsi `completeOnlinePayment` dan `confirmPaymentAndAdvance` tidak boleh dieksekusi berdasarkan interaksi UI pengguna tanpa respons payload sukses dari backend.
- Status pesanan lokal HANYA boleh diperbarui setelah memvalidasi respons endpoint:
  ```http
  GET /api/v1/payments/:bookingId
  ```
  atau ketika webhook/SSE dari backend mengonfirmasi `status === "PAID"`.

### Langkah 3: Mekanisme Polling / Sinkronisasi Real-Time
- Pada layar status pembayaran (`OrderStatusScreen`), terapkan sinkronisasi periodik (misal polling setiap 5–10 detik) ke backend untuk memeriksa status mutasi pembayaran rekening BRI atau QRIS.
- Ketika backend mengonfirmasi pelunasan, barulah aplikasi mobile memperbarui state lokal menjadi `mobilSiapDigunakan`.

### Langkah 4: Validasi QR Code / E-Ticket di Lapangan
- Pastikan QR Code yang tertera pada E-Ticket diverifikasi oleh staf operasional lapangan menggunakan sistem pemindai yang terhubung secara daring ke API backend (`GET /api/v1/admin/bookings/:id`), bukan sekadar pemeriksaan visual.
