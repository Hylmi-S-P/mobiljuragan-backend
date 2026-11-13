import { BASE_ORIGIN, sqlUji, startHarness, stopServer } from './harness.js';
import {
  api,
  assignDriver,
  berkasJpeg,
  berkasKebesaran,
  berkasPdf,
  buatAdminBaru,
  confirmTariff,
  createBooking,
  createDriver,
  createPayment,
  createTicket,
  createVehicle,
  handoverTiket,
  handover,
  harapan,
  loginAdmin,
  loginCustomer,
  requestDocumentRevision,
  uploadDocuments,
  uploadPaymentProof,
  uploadSemuaDokumen,
  verifyDocuments,
  verifyPayment,
  type ResponsApi,
} from './fixtures.js';

/*
 * Runner E2E.
 *
 * Setiap kasus berdiri sendiri: membuat armada dan pelanggan baru dengan nomor
 * HP unik, sehingga bisa dijalankan berulang tanpa bergantung pada sisa data.
 * Database uji juga dikosongkan di awal run oleh harness.
 *
 * Kasus negatif sengaja menuliskan perilaku yang SEHARUSNYA terjadi. Kalau kode
 * saat ini belum memenuhinya, kasus dibiarkan gagal sebagai bukti bug; asersi
 * tidak dilemahkan supaya tabel tetap hijau.
 */

interface Konteks {
  adminToken: string;
}

interface Kasus {
  id: string;
  nama: string;
  fn: (ctx: Konteks) => Promise<void>;
}

interface HasilKasus {
  id: string;
  nama: string;
  lulus: boolean;
  durasiMs: number;
  error?: string;
}

/** Memastikan respons ditolak dengan status dan kode galat yang diharapkan. */
function pastikanDitolak(
  respons: ResponsApi,
  status: number,
  kode: string,
  konteks: string,
): void {
  const kodeAktual = respons.body?.error?.code ?? 'tanpa-kode';
  const pesanAktual = respons.body?.error?.message ?? JSON.stringify(respons.body);

  if (respons.status !== status || kodeAktual !== kode) {
    throw new Error(
      `${konteks}: diharapkan HTTP ${status} [${kode}] tetapi menerima ` +
        `${respons.status} [${kodeAktual}] ${pesanAktual}`,
    );
  }
}

async function siapkanPesanan(
  adminToken: string,
  rentalType: 'WITHOUT_DRIVER' | 'WITH_DRIVER' = 'WITHOUT_DRIVER',
): Promise<{
  customerToken: string;
  vehicle: any;
  booking: any;
}> {
  const pelanggan = await loginCustomer();
  const vehicle = await createVehicle(adminToken);
  const booking = await createBooking(pelanggan.token, vehicle.id, { rentalType });
  return { customerToken: pelanggan.token, vehicle, booking };
}

/** Membaca baris dokumen pesanan apa adanya, termasuk sisa target penolakan. */
async function ambilDokumen(customerToken: string, bookingId: string): Promise<any> {
  const respons = await api(`/bookings/${bookingId}/documents`, { token: customerToken });
  harapan(respons, 200, 'baca dokumen pesanan');
  return respons.body.data?.document ?? respons.body.data;
}

/** Menyiapkan pesanan yang sudah dibayar dan menunggu penyerahan armada. */
async function siapkanPesananTerbayar(adminToken: string): Promise<{
  customerToken: string;
  vehicle: any;
  booking: any;
  paymentId: string;
  totalAmount: number;
}> {
  const pesanan = await siapkanPesanan(adminToken);
  const unggah = await uploadSemuaDokumen(pesanan.customerToken, pesanan.booking.id);
  harapan(unggah, 200, 'unggah dokumen');
  const verifikasi = await verifyDocuments(adminToken, pesanan.booking.id, 'APPROVE');
  harapan(verifikasi, 200, 'verifikasi dokumen');

  const konfirmasi = await confirmTariff(adminToken, pesanan.booking.id);
  if (konfirmasi.status !== 'CONFIRMED') {
    throw new Error(`tarif harus CONFIRMED, menerima ${konfirmasi.status}`);
  }

  const tagihan = await createPayment(pesanan.customerToken, pesanan.booking.id);
  harapan(tagihan, 201, 'buat tagihan');
  const paymentId = tagihan.body.data.id;
  const totalAmount = Number(tagihan.body.data.totalAmount);

  const bukti = await uploadPaymentProof(pesanan.customerToken, paymentId);
  harapan(bukti, 200, 'unggah bukti transfer');

  const lunas = await verifyPayment(adminToken, paymentId, 'APPROVE');
  harapan(lunas, 200, 'verifikasi pembayaran');
  if (lunas.body.data.status !== 'PAID') {
    throw new Error(`pembayaran harus PAID, menerima ${lunas.body.data.status}`);
  }

  return { ...pesanan, paymentId, totalAmount };
}

const kasus: Kasus[] = [
  {
    id: 'smoke',
    nama: 'Server hidup, login admin dan pelanggan berhasil',
    async fn({ adminToken }) {
      const kesehatan = await fetch(`${BASE_ORIGIN}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (kesehatan.status !== 200) {
        throw new Error(`GET /health mengembalikan HTTP ${kesehatan.status}`);
      }

      const pelanggan = await loginCustomer();
      if (!adminToken || !pelanggan.token) {
        throw new Error('Login berhasil tetapi token tidak dikembalikan.');
      }
    },
  },
  {
    id: 'S6',
    nama: 'Aksi dokumen pada pesanan final ditolak 409',
    async fn({ adminToken }) {
      const { customerToken, vehicle, booking } = await siapkanPesanan(adminToken);

      const batal = await api(`/bookings/${booking.id}/cancel`, {
        method: 'PATCH',
        token: customerToken,
      });
      harapan(batal, 200, 'batalkan pesanan untuk membuat status final');

      const unggah = await uploadDocuments(customerToken, booking.id, {
        statementLetter: await berkasJpeg('surat-pernyataan.jpg'),
      });
      pastikanDitolak(
        unggah,
        409,
        'BOOKING_FINAL',
        'unggah dokumen pada pesanan berstatus CANCELLED',
      );

      // Pastikan armada tidak mengganggu kasus lain; pembatalan sudah
      // mengembalikan status armada ke AVAILABLE di model.
      void vehicle;
    },
  },
  {
    id: 'H6',
    nama: 'Pesan ke tiket RESOLVED/CLOSED ditolak 409',
    async fn({ adminToken }) {
      const pelanggan = await loginCustomer();
      const tiket = await createTicket(pelanggan.token);

      /* Tiket pelanggan lahir dipegang asisten AI. Admin baru boleh mengubah
         statusnya setelah tiket diserahkan ke manusia. Endpoint tutup milik
         pelanggan tidak dipakai di sini karena kasus ini menguji penolakan
         pesan, bukan perilaku endpoint tutup. */
      const serah = await api(`/tickets/${tiket.id}/handover`, {
        method: 'POST',
        token: pelanggan.token,
      });
      harapan(serah, [200, 201], 'serahkan tiket ke admin');

      /* Staf tidak lagi boleh menutup tiket (lihat T5.5), jadi status akhir
         diset langsung seperti yang dilakukan penjadwal sistem. Yang diuji di sini
         adalah penolakan pesan pada tiket final, bukan cara tiket menjadi final. */
      await sqlUji('UPDATE support_tickets SET status = ? WHERE id = ?', ['RESOLVED', tiket.id]);

      const pesan = await api(`/tickets/${tiket.id}/messages`, {
        method: 'POST',
        token: pelanggan.token,
        body: { body: 'Pesan setelah tiket selesai.' },
      });
      pastikanDitolak(
        pesan,
        409,
        'TICKET_CLOSED',
        'kirim pesan ke tiket RESOLVED',
      );
    },
  },
  {
    id: 'B2',
    nama: 'Serah armada ditolak selama pembayaran belum PAID',
    async fn({ adminToken }) {
      const { customerToken, booking } = await siapkanPesanan(adminToken);

      const unggah = await uploadSemuaDokumen(customerToken, booking.id);
      harapan(unggah, 200, 'unggah dokumen lengkap');

      const verifikasi = await verifyDocuments(adminToken, booking.id, 'APPROVE');
      harapan(verifikasi, 200, 'verifikasi dokumen');

      await confirmTariff(adminToken, booking.id);

      const serah = await handover(adminToken, booking.id);
      pastikanDitolak(
        serah,
        409,
        'PAYMENT_NOT_VERIFIED',
        'serah armada tanpa pembayaran PAID',
      );
    },
  },
  {
    id: 'C3',
    nama: 'Validasi jenis dan ukuran berkas dokumen',
    async fn({ adminToken }) {
      const { customerToken, booking } = await siapkanPesanan(adminToken);

      const pdf = await uploadDocuments(customerToken, booking.id, {
        statementLetter: berkasPdf(),
      });
      pastikanDitolak(
        pdf,
        400,
        'UNSUPPORTED_FILE_TYPE',
        'unggah PDF sebagai dokumen',
      );

      const jpeg = await uploadDocuments(customerToken, booking.id, {
        statementLetter: await berkasJpeg('surat-pernyataan.jpg'),
      });
      harapan(jpeg, 200, 'unggah JPEG valid sebagai dokumen');

      const kebesaran = await uploadDocuments(customerToken, booking.id, {
        ktp: berkasKebesaran(),
      });
      pastikanDitolak(
        kebesaran,
        413,
        'FILE_TOO_LARGE',
        'unggah dokumen melebihi 5 MB',
      );
    },
  },
  {
    id: 'A12',
    nama: 'Pembayaran sebelum tarif dikonfirmasi ditolak 409',
    async fn({ adminToken }) {
      const { customerToken, booking } = await siapkanPesanan(adminToken);

      const pembayaran = await createPayment(customerToken, booking.id);
      pastikanDitolak(
        pembayaran,
        409,
        'BOOKING_NOT_QUOTED',
        'buat pembayaran sebelum tarif dikonfirmasi',
      );
    },
  },
  {
    id: 'T1.1',
    nama: 'Tenggat dokumen berjalan, berhenti saat diperiksa, dan membatalkan pesanan',
    async fn({ adminToken }) {
      const { customerToken, booking } = await siapkanPesanan(adminToken);

      const bacaTenggat = async (token: string, id: string) => {
        const respons = await api(`/bookings/${id}`, { token });
        harapan(respons, 200, 'buka detail pesanan');
        return respons.body.data.deadline as {
          state: string;
          deadlineAt: string | null;
          pausedReason: string | null;
        };
      };

      const sisaJam = (iso: string | null): number =>
        iso ? (new Date(iso).getTime() - Date.now()) / 3_600_000 : Number.NaN;

      // 1. Pesanan baru: jam berjalan dengan jendela 2 jam.
      const awal = await bacaTenggat(customerToken, booking.id);
      if (awal.state !== 'RUNNING') {
        throw new Error(`tenggat pesanan baru: diharapkan RUNNING, menerima ${awal.state}`);
      }
      if (!(sisaJam(awal.deadlineAt) > 1.9 && sisaJam(awal.deadlineAt) <= 2.01)) {
        throw new Error(
          `tenggat pesanan baru: diharapkan sekitar 2 jam, menerima ${sisaJam(awal.deadlineAt).toFixed(2)} jam`,
        );
      }

      // 2. Berkas diunggah: jam berhenti menunggu admin.
      harapan(await uploadSemuaDokumen(customerToken, booking.id), 200, 'unggah semua dokumen');
      const setelahUnggah = await bacaTenggat(customerToken, booking.id);
      if (setelahUnggah.state !== 'PAUSED') {
        throw new Error(
          `tenggat setelah unggah: diharapkan PAUSED, menerima ${setelahUnggah.state}`,
        );
      }
      if (!setelahUnggah.pausedReason) {
        throw new Error('tenggat setelah unggah: alasan jeda tidak dikirim ke klien');
      }

      // 3. Ditolak: jam berjalan lagi dengan jendela 12 jam.
      harapan(
        await verifyDocuments(adminToken, booking.id, 'REJECT', ['KTP']),
        200,
        'tolak dokumen',
      );
      const setelahDitolak = await bacaTenggat(customerToken, booking.id);
      if (setelahDitolak.state !== 'RUNNING') {
        throw new Error(
          `tenggat setelah ditolak: diharapkan RUNNING, menerima ${setelahDitolak.state}`,
        );
      }
      if (
        !(sisaJam(setelahDitolak.deadlineAt) > 11.9 && sisaJam(setelahDitolak.deadlineAt) <= 12.01)
      ) {
        throw new Error(
          `tenggat setelah ditolak: diharapkan sekitar 12 jam, menerima ${sisaJam(setelahDitolak.deadlineAt).toFixed(2)} jam`,
        );
      }

      // 4. Disetujui: tidak ada lagi yang dikejar.
      harapan(await verifyDocuments(adminToken, booking.id, 'APPROVE'), 200, 'setujui dokumen');
      const setelahDisetujui = await bacaTenggat(customerToken, booking.id);
      if (setelahDisetujui.state !== 'NONE') {
        throw new Error(
          `tenggat setelah disetujui: diharapkan NONE, menerima ${setelahDisetujui.state}`,
        );
      }

      // 5. Pesanan yang tenggatnya lewat dibatalkan otomatis oleh penjadwal.
      const kedua = await siapkanPesanan(adminToken);
      /*
       * Tenggat dimundurkan lewat SQL, bukan lewat API, karena tidak ada endpoint
       * yang boleh memalsukan waktu. Nilainya dihitung dengan UTC_TIMESTAMP:
       * Prisma menyimpan DateTime sebagai UTC di kolom DATETIME, sedangkan driver
       * mentah menulis jam lokal, sehingga mengirim objek Date dari Node akan
       * menghasilkan selisih zona waktu.
       */
      await sqlUji(
        'UPDATE bookings SET documentDeadlineAt = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE id = ?',
        [kedua.booking.id],
      );

      const batas = Date.now() + 15_000;
      let statusAkhir = '';
      while (Date.now() < batas) {
        const cek = await api(`/bookings/${kedua.booking.id}`, { token: kedua.customerToken });
        statusAkhir = cek.body?.data?.status ?? '';
        if (statusAkhir === 'CANCELLED') break;
        await new Promise((selesai) => setTimeout(selesai, 500));
      }

      if (statusAkhir !== 'CANCELLED') {
        throw new Error(
          `pesanan kedaluwarsa: diharapkan CANCELLED, menerima ${statusAkhir || 'tanpa status'}`,
        );
      }
    },
  },
  {
    id: 'T1.2',
    nama: 'Sewa yang jadwalnya lewat diselesaikan otomatis dan armadanya masuk pemeriksaan',
    async fn({ adminToken }) {
      const { customerToken, vehicle, booking } = await siapkanPesanan(adminToken);

      harapan(await uploadSemuaDokumen(customerToken, booking.id), 200, 'unggah dokumen');
      harapan(await verifyDocuments(adminToken, booking.id, 'APPROVE'), 200, 'verifikasi dokumen');
      await confirmTariff(adminToken, booking.id);

      const tagihan = await createPayment(customerToken, booking.id);
      harapan(tagihan, 201, 'buat tagihan');
      const paymentId = tagihan.body.data.id as string;

      harapan(await uploadPaymentProof(customerToken, paymentId), 200, 'unggah bukti bayar');
      harapan(await verifyPayment(adminToken, paymentId, 'APPROVE'), 200, 'verifikasi pembayaran');
      harapan(await handover(adminToken, booking.id), 200, 'serah armada');

      /*
       * Jadwal dimundurkan lewat SQL karena tidak ada endpoint yang boleh
       * memalsukan waktu. UTC_TIMESTAMP dipakai supaya nilainya sejalan dengan
       * cara Prisma menyimpan DateTime.
       */
      await sqlUji(
        'UPDATE bookings SET endDateTime = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE id = ?',
        [booking.id],
      );

      const batas = Date.now() + 15_000;
      let statusAkhir = '';
      while (Date.now() < batas) {
        const cek = await api(`/bookings/${booking.id}`, { token: customerToken });
        statusAkhir = cek.body?.data?.status ?? '';
        if (statusAkhir === 'COMPLETED') break;
        await new Promise((selesai) => setTimeout(selesai, 500));
      }

      if (statusAkhir !== 'COMPLETED') {
        throw new Error(
          `sewa lewat jadwal: diharapkan COMPLETED, menerima ${statusAkhir || 'tanpa status'}`,
        );
      }

      const armada = await api(`/vehicles/${vehicle.id}`);
      harapan(armada, 200, 'buka detail armada');
      const statusArmada = armada.body?.data?.operationalStatus;
      if (statusArmada !== 'IN_SERVICE') {
        throw new Error(
          `armada setelah sewa selesai: diharapkan IN_SERVICE, menerima ${statusArmada}`,
        );
      }
    },
  },
  {
    id: 'T1.3',
    nama: 'Tagihan yang lewat batas waktu membatalkan pesanan dan mengembalikan armada',
    async fn({ adminToken }) {
      const { customerToken, vehicle, booking } = await siapkanPesanan(adminToken);

      harapan(await uploadSemuaDokumen(customerToken, booking.id), 200, 'unggah dokumen');
      harapan(await verifyDocuments(adminToken, booking.id, 'APPROVE'), 200, 'verifikasi dokumen');
      await confirmTariff(adminToken, booking.id);

      const tagihan = await createPayment(customerToken, booking.id);
      harapan(tagihan, 201, 'buat tagihan');
      const paymentId = tagihan.body.data.id as string;

      /*
       * Batas waktu dimundurkan lewat SQL, bukan dengan menunggu dua jam. Nilai
       * ditulis sebagai UTC karena Prisma membaca kolom DATETIME sebagai UTC.
       */
      await sqlUji(
        'UPDATE payments SET expiresAt = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE id = ?',
        [paymentId],
      );

      const batas = Date.now() + 15_000;
      let statusPesanan = '';
      while (Date.now() < batas) {
        const cek = await api(`/bookings/${booking.id}`, { token: customerToken });
        statusPesanan = cek.body?.data?.status ?? '';
        if (statusPesanan === 'CANCELLED') break;
        await new Promise((selesai) => setTimeout(selesai, 500));
      }

      if (statusPesanan !== 'CANCELLED') {
        throw new Error(
          `tagihan kedaluwarsa: diharapkan pesanan CANCELLED, menerima ${statusPesanan || 'tanpa status'}`,
        );
      }

      const detailTagihan = await api(`/payments/${paymentId}`, { token: customerToken });
      harapan(detailTagihan, 200, 'buka detail tagihan');
      const statusTagihan = detailTagihan.body?.data?.status;
      if (statusTagihan !== 'FAILED') {
        throw new Error(
          `tagihan kedaluwarsa: diharapkan FAILED, menerima ${statusTagihan || 'tanpa status'}`,
        );
      }

      const armada = await api(`/vehicles/${vehicle.id}`);
      harapan(armada, 200, 'buka detail armada');
      const statusArmada = armada.body?.data?.operationalStatus;
      if (statusArmada !== 'AVAILABLE') {
        throw new Error(
          `armada setelah tagihan kedaluwarsa: diharapkan AVAILABLE, menerima ${statusArmada}`,
        );
      }
    },
  },
  {
    id: 'T1.7',
    nama: 'Permintaan yang menunggu tarif menahan armada, lalu dilepas saat tenggat admin lewat',
    async fn({ adminToken }) {
      const { customerToken, vehicle, booking } = await siapkanPesanan(adminToken);

      /* Sejak permintaan diterima langsung menahan unit, sewa lepas kunci wajib
         sudah punya dokumen terverifikasi pada langkah ini. */
      harapan(await uploadSemuaDokumen(customerToken, booking.id), 200, 'unggah dokumen');
      harapan(await verifyDocuments(adminToken, booking.id, 'APPROVE'), 200, 'setujui dokumen');

      const terima = await api(`/admin/bookings/${booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'PENDING_CONFIRMATION' },
      });
      harapan(terima, 200, 'terima permintaan');

      const { startDateTime, endDateTime } = booking;
      const kueri = `startDate=${encodeURIComponent(startDateTime)}&endDate=${encodeURIComponent(endDateTime)}`;

      const katalogTertahan = await api(`/vehicles?${kueri}`);
      harapan(katalogTertahan, 200, 'buka katalog saat armada tertahan');
      const idTertahan = (katalogTertahan.body?.data ?? []).map((v: any) => v.id);
      if (idTertahan.includes(vehicle.id)) {
        throw new Error('katalog masih menampilkan armada yang sedang menunggu konfirmasi tarif');
      }

      /* Pelanggan lain tidak boleh memesan unit yang sama untuk tanggal yang sama,
         karena katalog pun sudah menyembunyikannya. */
      const pelangganLain = await loginCustomer();
      const pesananBentrok = await api('/bookings', {
        method: 'POST',
        token: pelangganLain.token,
        body: {
          vehicleId: vehicle.id,
          rentalType: 'WITHOUT_DRIVER',
          pickupLocation: 'Bandara Juanda',
          numberGuests: 2,
          startDateTime,
          endDateTime,
        },
      });
      if (pesananBentrok.status !== 409) {
        throw new Error(
          `pesanan bentrok: diharapkan HTTP 409, menerima ${pesananBentrok.status} ` +
            `${JSON.stringify(pesananBentrok.body)}`,
        );
      }

      await sqlUji(
        'UPDATE bookings SET adminDeadlineAt = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE id = ?',
        [booking.id],
      );

      const batas = Date.now() + 15_000;
      let statusPesanan = '';
      while (Date.now() < batas) {
        const cek = await api(`/bookings/${booking.id}`, { token: customerToken });
        statusPesanan = cek.body?.data?.status ?? '';
        if (statusPesanan === 'CANCELLED') break;
        await new Promise((selesai) => setTimeout(selesai, 500));
      }

      if (statusPesanan !== 'CANCELLED') {
        throw new Error(
          `tenggat admin lewat: diharapkan CANCELLED, menerima ${statusPesanan || 'tanpa status'}`,
        );
      }

      const katalogLepas = await api(`/vehicles?${kueri}`);
      harapan(katalogLepas, 200, 'buka katalog setelah armada dilepas');
      const idLepas = (katalogLepas.body?.data ?? []).map((v: any) => v.id);
      if (!idLepas.includes(vehicle.id)) {
        throw new Error('armada tidak kembali muncul di katalog setelah pesanan dibatalkan');
      }
    },
  },
  {
    id: 'T2.1',
    nama: 'Tarif dihitung dari katalog dan tidak bisa ditimpa staf',
    async fn({ adminToken }) {
      /* Lepas kunci: 2 hari × Rp 350.000 = Rp 700.000, tanpa jasa supir.
         Nominal yang dikirim staf sengaja diisi angka asal untuk memastikan
         server mengabaikannya, bukan memakainya. */
      const lepasKunci = await siapkanPesanan(adminToken);

      /* Lepas kunci wajib punya dokumen terverifikasi sebelum tarif dikonfirmasi. */
      const unggah = await uploadSemuaDokumen(lepasKunci.customerToken, lepasKunci.booking.id);
      harapan(unggah, 200, 'unggah dokumen lepas kunci');
      const verifikasi = await verifyDocuments(adminToken, lepasKunci.booking.id, 'APPROVE');
      harapan(verifikasi, 200, 'verifikasi dokumen lepas kunci');

      const kePending = await api(`/admin/bookings/${lepasKunci.booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'PENDING_CONFIRMATION' },
      });
      harapan(kePending, 200, 'terima permintaan lepas kunci');

      const konfirmasi = await api(`/admin/bookings/${lepasKunci.booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'CONFIRMED', routeScope: 'DALAM_KOTA', quotedAmount: 1 },
      });
      harapan(konfirmasi, 200, 'konfirmasi tarif lepas kunci');

      const data = konfirmasi.body.data;
      const rincian = data.tariffBreakdown;

      if (Number(data.quotedAmount) !== 700_000) {
        throw new Error(
          `tarif lepas kunci: diharapkan 700000 dari katalog, menerima ${data.quotedAmount}`,
        );
      }
      if (!rincian || rincian.hariSewa !== 2 || rincian.hargaPerHari !== 350_000) {
        throw new Error(`rincian tarif lepas kunci tidak sesuai: ${JSON.stringify(rincian)}`);
      }
      if (rincian.jasaSupir !== 0) {
        throw new Error(`lepas kunci tidak boleh menagih jasa supir, menerima ${rincian.jasaSupir}`);
      }

      /* Bersupir: harga sewa tetap dari katalog, ditambah tarif supir global
         Rp 150.000/hari × 2 hari = Rp 300.000. */
      const supir = await createDriver(adminToken);
      const bersupir = await siapkanPesanan(adminToken, 'WITH_DRIVER');
      await assignDriver(adminToken, bersupir.booking.id, supir.id);

      const konfirmasiSupir = await confirmTariff(adminToken, bersupir.booking.id);
      if (Number(konfirmasiSupir.quotedAmount) !== 1_000_000) {
        throw new Error(
          `tarif bersupir: diharapkan 1000000, menerima ${konfirmasiSupir.quotedAmount}`,
        );
      }
      if (konfirmasiSupir.tariffBreakdown?.jasaSupir !== 300_000) {
        throw new Error(
          `jasa supir: diharapkan 300000, menerima ${konfirmasiSupir.tariffBreakdown?.jasaSupir}`,
        );
      }

      /* Tarif supir global bisa diubah admin; perubahan itu harus langsung
         terpakai pada konfirmasi berikutnya. */
      const ubahTarif = await api('/admin/fleet/tariff-settings', {
        method: 'PATCH',
        token: adminToken,
        body: { driverDailyRate: 200_000 },
      });
      harapan(ubahTarif, 200, 'ubah tarif supir global');

      const supirKedua = await createDriver(adminToken);
      const bersupirKedua = await siapkanPesanan(adminToken, 'WITH_DRIVER');
      await assignDriver(adminToken, bersupirKedua.booking.id, supirKedua.id);

      const konfirmasiKedua = await confirmTariff(adminToken, bersupirKedua.booking.id);
      if (Number(konfirmasiKedua.quotedAmount) !== 1_100_000) {
        throw new Error(
          `tarif supir global baru: diharapkan 1100000, menerima ${konfirmasiKedua.quotedAmount}`,
        );
      }

      const pulihkan = await api('/admin/fleet/tariff-settings', {
        method: 'PATCH',
        token: adminToken,
        body: { driverDailyRate: 150_000 },
      });
      harapan(pulihkan, 200, 'pulihkan tarif supir global');
    },
  },
  {
    id: 'T2.3',
    nama: 'Tolak pembayaran membiarkan pesanan hidup, tolak & batalkan mematikan pesanan',
    async fn({ adminToken }) {
      /* Penolakan biasa: bukti bayar ditolak, pesanan tetap CONFIRMED supaya
         pelanggan bisa mengunggah ulang. */
      const pertama = await siapkanPesanan(adminToken);
      const unggahDokumen = await uploadSemuaDokumen(pertama.customerToken, pertama.booking.id);
      harapan(unggahDokumen, 200, 'unggah dokumen');
      const verifikasiDokumen = await verifyDocuments(adminToken, pertama.booking.id, 'APPROVE');
      harapan(verifikasiDokumen, 200, 'verifikasi dokumen');

      /* `confirmTariff` sudah memindahkan pesanan ke PENDING_CONFIRMATION lalu
         mengonfirmasinya, jadi tidak perlu langkah terima permintaan terpisah. */
      const konfirmasi = await confirmTariff(adminToken, pertama.booking.id);
      if (konfirmasi.status !== 'CONFIRMED') {
        throw new Error(`tarif pesanan pertama harus CONFIRMED, menerima ${konfirmasi.status}`);
      }
      const tagihan = await createPayment(pertama.customerToken, pertama.booking.id);
      harapan(tagihan, 201, 'buat tagihan');
      const paymentId = tagihan.body.data.id;

      const bukti = await uploadPaymentProof(pertama.customerToken, paymentId);
      harapan(bukti, 200, 'unggah bukti transfer');

      const tolak = await verifyPayment(adminToken, paymentId, 'REJECT', {
        notes: 'Nominal tidak sesuai.',
      });
      harapan(tolak, 200, 'tolak pembayaran');
      if (tolak.body.data.status !== 'FAILED') {
        throw new Error(`pembayaran ditolak harus FAILED, menerima ${tolak.body.data.status}`);
      }

      const setelahTolak = await api(`/bookings/${pertama.booking.id}`, {
        token: pertama.customerToken,
      });
      harapan(setelahTolak, 200, 'baca pesanan setelah ditolak');
      if (setelahTolak.body.data.status !== 'CONFIRMED') {
        throw new Error(
          `penolakan biasa tidak boleh membatalkan pesanan, menerima ${setelahTolak.body.data.status}`,
        );
      }

      /* Pelanggan masih boleh mengunggah ulang setelah ditolak. */
      const unggahUlang = await uploadPaymentProof(pertama.customerToken, paymentId);
      harapan(unggahUlang, 200, 'unggah ulang bukti transfer');

      /* Penolakan dengan pembatalan: pesanan mati, armada kembali tersedia. */
      const kedua = await siapkanPesanan(adminToken);
      const unggahDokumen2 = await uploadSemuaDokumen(kedua.customerToken, kedua.booking.id);
      harapan(unggahDokumen2, 200, 'unggah dokumen pesanan kedua');
      const verifikasiDokumen2 = await verifyDocuments(adminToken, kedua.booking.id, 'APPROVE');
      harapan(verifikasiDokumen2, 200, 'verifikasi dokumen pesanan kedua');

      const konfirmasi2 = await confirmTariff(adminToken, kedua.booking.id);
      if (konfirmasi2.status !== 'CONFIRMED') {
        throw new Error(`tarif pesanan kedua harus CONFIRMED, menerima ${konfirmasi2.status}`);
      }

      const tagihan2 = await createPayment(kedua.customerToken, kedua.booking.id);
      harapan(tagihan2, 201, 'buat tagihan pesanan kedua');
      const paymentId2 = tagihan2.body.data.id;

      const bukti2 = await uploadPaymentProof(kedua.customerToken, paymentId2);
      harapan(bukti2, 200, 'unggah bukti transfer pesanan kedua');

      const tolakBatal = await verifyPayment(adminToken, paymentId2, 'REJECT', {
        notes: 'Indikasi penipuan.',
        cancelBooking: true,
      });
      harapan(tolakBatal, 200, 'tolak dan batalkan');

      const setelahBatal = await api(`/bookings/${kedua.booking.id}`, {
        token: kedua.customerToken,
      });
      harapan(setelahBatal, 200, 'baca pesanan setelah dibatalkan');
      if (setelahBatal.body.data.status !== 'CANCELLED') {
        throw new Error(
          `tolak & batalkan harus CANCELLED, menerima ${setelahBatal.body.data.status}`,
        );
      }

      const armada = await api(`/vehicles/${kedua.vehicle.id}`, { token: adminToken });
      harapan(armada, 200, 'baca armada setelah dibatalkan');
      if (armada.body.data.operationalStatus !== 'AVAILABLE') {
        throw new Error(
          `armada harus kembali AVAILABLE, menerima ${armada.body.data.operationalStatus}`,
        );
      }

      /* Pembatalan tidak boleh menyertai persetujuan. */
      const salahPakai = await verifyPayment(adminToken, paymentId2, 'APPROVE', {
        cancelBooking: true,
      });
      harapan(salahPakai, 400, 'tolak cancelBooking pada persetujuan');
    },
  },
  {
    id: 'T2.4',
    nama: 'Satu nomor hanya boleh memegang dua pesanan aktif',
    async fn({ adminToken }) {
      const pelanggan = await loginCustomer();

      /* Tiga armada berbeda supaya yang menolak adalah batas per nomor, bukan
         bentrok jadwal pada armada yang sama. */
      const armada = [
        await createVehicle(adminToken),
        await createVehicle(adminToken),
        await createVehicle(adminToken),
      ];

      const pertama = await createBooking(pelanggan.token, armada[0].id);
      const kedua = await createBooking(pelanggan.token, armada[1].id);

      const ketiga = await api('/bookings', {
        method: 'POST',
        token: pelanggan.token,
        body: {
          vehicleId: armada[2].id,
          rentalType: 'WITHOUT_DRIVER',
          pickupLocation: 'Bandara Juanda',
          numberGuests: 2,
          startDateTime: new Date(Date.now() + 10 * 86_400_000).toISOString(),
          endDateTime: new Date(Date.now() + 12 * 86_400_000).toISOString(),
        },
      });

      harapan(ketiga, 409, 'pesanan ketiga ditolak');
      if (ketiga.body.error?.code !== 'BOOKING_ACTIVE_LIMIT_REACHED') {
        throw new Error(
          `kode galat batas pesanan tidak sesuai: ${JSON.stringify(ketiga.body.error)}`,
        );
      }

      /* Setelah satu pesanan dibatalkan, nomor itu boleh memesan lagi. */
      const batal = await api(`/bookings/${pertama.id}/cancel`, {
        method: 'PATCH',
        token: pelanggan.token,
        body: { reason: 'Ganti rencana.' },
      });
      harapan(batal, 200, 'batalkan pesanan pertama');

      const keempat = await api('/bookings', {
        method: 'POST',
        token: pelanggan.token,
        body: {
          vehicleId: armada[2].id,
          rentalType: 'WITHOUT_DRIVER',
          pickupLocation: 'Bandara Juanda',
          numberGuests: 2,
          startDateTime: new Date(Date.now() + 10 * 86_400_000).toISOString(),
          endDateTime: new Date(Date.now() + 12 * 86_400_000).toISOString(),
        },
      });
      harapan(keempat, 201, 'pesanan baru setelah satu dibatalkan');

      /* Pastikan pesanan kedua memang masih hidup, bukan dibatalkan diam-diam. */
      const cek = await api(`/bookings/${kedua.id}`, { token: pelanggan.token });
      harapan(cek, 200, 'baca pesanan kedua');
      if (cek.body.data.status !== 'CREATED') {
        throw new Error(`pesanan kedua harus tetap CREATED, menerima ${cek.body.data.status}`);
      }
    },
  },
  {
    id: 'T2.5',
    nama: 'Refund tercatat di server: pelanggan dipotong, admin/sistem dikembalikan penuh',
    async fn({ adminToken }) {
      /* 1. Pelanggan membatalkan setelah membayar: dipotong Rp 50.000. */
      const olehPelanggan = await siapkanPesananTerbayar(adminToken);

      const batal = await api(`/bookings/${olehPelanggan.booking.id}/cancel`, {
        method: 'PATCH',
        token: olehPelanggan.customerToken,
        body: {
          reason: 'Rencana berubah.',
          /* Rekening yang diisi pelanggan di aplikasi harus ikut tersimpan,
             supaya kantor tidak perlu menelepon untuk menanyakan tujuan transfer. */
          refundAccount: {
            bankName: 'Bank Papua',
            accountNumber: '1234567890',
            accountHolderName: 'Yahya Pratama',
          },
        },
      });
      harapan(batal, 200, 'pelanggan membatalkan');

      const refundPelanggan = batal.body.data.booking.refund;
      if (!refundPelanggan) {
        throw new Error('pembatalan oleh pelanggan tidak membuat catatan refund');
      }
      if (refundPelanggan.namaBank !== 'Bank Papua') {
        throw new Error(`namaBank refund harus tersimpan, menerima ${refundPelanggan.namaBank}`);
      }
      if (refundPelanggan.nomorRekening !== '1234567890') {
        throw new Error(
          `nomorRekening refund harus tersimpan, menerima ${refundPelanggan.nomorRekening}`,
        );
      }
      if (refundPelanggan.namaPemilik !== 'Yahya Pratama') {
        throw new Error(
          `namaPemilik refund harus tersimpan, menerima ${refundPelanggan.namaPemilik}`,
        );
      }
      if (Number(refundPelanggan.potongan) !== 50_000) {
        throw new Error(
          `potongan pelanggan harus 50000, menerima ${refundPelanggan.potongan}`,
        );
      }
      if (Number(refundPelanggan.nominal) !== olehPelanggan.totalAmount - 50_000) {
        throw new Error(
          `nominal refund pelanggan harus ${olehPelanggan.totalAmount - 50_000}, menerima ${refundPelanggan.nominal}`,
        );
      }
      if (refundPelanggan.dibatalkanOleh !== 'PELANGGAN') {
        throw new Error(
          `pembatal harus PELANGGAN, menerima ${refundPelanggan.dibatalkanOleh}`,
        );
      }

      const paymentPelanggan = await api(`/payments/${olehPelanggan.paymentId}`, {
        token: olehPelanggan.customerToken,
      });
      harapan(paymentPelanggan, 200, 'baca pembayaran setelah refund');
      if (paymentPelanggan.body.data.status !== 'REFUNDED') {
        throw new Error(
          `pembayaran harus REFUNDED, menerima ${paymentPelanggan.body.data.status}`,
        );
      }

      /* 2. Admin membatalkan setelah membayar: dikembalikan penuh. */
      const olehAdmin = await siapkanPesananTerbayar(adminToken);

      const batalAdmin = await api(`/admin/bookings/${olehAdmin.booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'CANCELLED', note: 'Unit dibutuhkan untuk pesanan lain.' },
      });
      harapan(batalAdmin, 200, 'admin membatalkan');

      const refundAdmin = batalAdmin.body.data.refund;
      if (!refundAdmin) {
        throw new Error('pembatalan oleh admin tidak membuat catatan refund');
      }
      if (Number(refundAdmin.potongan) !== 0) {
        throw new Error(`pembatalan admin tidak boleh memotong, menerima ${refundAdmin.potongan}`);
      }
      if (Number(refundAdmin.nominal) !== olehAdmin.totalAmount) {
        throw new Error(
          `refund admin harus penuh ${olehAdmin.totalAmount}, menerima ${refundAdmin.nominal}`,
        );
      }

      /* 3. Antrean refund di dashboard memuat baris yang belum ditutup. */
      const antrean = await api('/admin/refunds?status=MENUNGGU', { token: adminToken });
      harapan(antrean, 200, 'baca antrean refund');
      const kode = [olehPelanggan.booking.bookingCode, olehAdmin.booking.bookingCode];
      const ada = antrean.body.data.items.filter((baris: any) => kode.includes(baris.booking.bookingCode));
      if (ada.length !== 2) {
        throw new Error(`antrean refund harus memuat 2 baris uji, menerima ${ada.length}`);
      }

      /* 4. Admin boleh menimpa nominal, tetapi tidak boleh melebihi uang masuk. */
      const barisAdmin = ada.find((b: any) => b.booking.bookingCode === olehAdmin.booking.bookingCode);

      const kelebihan = await api(`/admin/refunds/${barisAdmin.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { nominal: olehAdmin.totalAmount + 1 },
      });
      harapan(kelebihan, 400, 'nominal melebihi pembayaran ditolak');

      const tutup = await api(`/admin/refunds/${barisAdmin.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: {
          nominal: olehAdmin.totalAmount - 10_000,
          namaBank: 'BRI',
          nomorRekening: '1234567890',
          namaPemilik: 'Pelanggan Uji',
          status: 'SELESAI',
          catatan: 'Sudah ditransfer 13 November.',
        },
      });
      harapan(tutup, 200, 'tutup pengembalian dana');
      if (tutup.body.data.status !== 'SELESAI') {
        throw new Error(`status refund harus SELESAI, menerima ${tutup.body.data.status}`);
      }
      if (Number(tutup.body.data.potongan) !== 10_000) {
        throw new Error(
          `potongan harus menyesuaikan nominal baru (10000), menerima ${tutup.body.data.potongan}`,
        );
      }

      /* Menutup tanpa bukti maupun catatan harus ditolak. */
      const barisPelanggan = ada.find(
        (b: any) => b.booking.bookingCode === olehPelanggan.booking.bookingCode,
      );
      const tanpaBukti = await api(`/admin/refunds/${barisPelanggan.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'SELESAI' },
      });
      harapan(tanpaBukti, 400, 'tutup tanpa bukti ditolak');
    },
  },
  {
    id: 'T2.7',
    nama:
      'Pesanan yang dibatalkan saat bukti transfer belum diperiksa masuk antrean refund dan dananya bisa dikonfirmasi',
    async fn({ adminToken }) {
      const pesanan = await siapkanPesanan(adminToken);
      harapan(
        await uploadSemuaDokumen(pesanan.customerToken, pesanan.booking.id),
        200,
        'unggah tiga dokumen',
      );
      harapan(
        await verifyDocuments(adminToken, pesanan.booking.id, 'APPROVE'),
        200,
        'verifikasi dokumen',
      );

      const konfirmasi = await confirmTariff(adminToken, pesanan.booking.id);
      if (konfirmasi.status !== 'CONFIRMED') {
        throw new Error(`tarif harus CONFIRMED, menerima ${konfirmasi.status}`);
      }

      const tagihan = await createPayment(pesanan.customerToken, pesanan.booking.id);
      harapan(tagihan, 201, 'buat tagihan');
      const paymentId = tagihan.body.data.id;
      const totalAmount = Number(tagihan.body.data.totalAmount);

      /* Bukti diunggah tetapi sengaja TIDAK diverifikasi: inilah kasus lapangan
         ketika staf mencurigai penipuan dan langsung menutup pesanan. */
      harapan(
        await uploadPaymentProof(pesanan.customerToken, paymentId),
        200,
        'unggah bukti transfer',
      );

      const batal = await api(`/admin/bookings/${pesanan.booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'CANCELLED', note: 'Indikasi penipuan saat pemeriksaan bukti transfer.' },
      });
      harapan(batal, 200, 'admin membatalkan sebelum verifikasi pembayaran');

      const refund = batal.body.data.refund;
      if (!refund) {
        throw new Error('pembatalan sebelum verifikasi pembayaran tidak membuat catatan refund');
      }
      if (refund.danaTerverifikasi !== false) {
        throw new Error(
          `refund harus ditandai belum terverifikasi, menerima ${refund.danaTerverifikasi}`,
        );
      }
      if (Number(refund.potongan) !== 0) {
        throw new Error(`potongan harus 0 saat dana belum terverifikasi, menerima ${refund.potongan}`);
      }
      if (Number(refund.nominal) !== totalAmount) {
        throw new Error(
          `nominal harus penuh ${totalAmount}, menerima ${refund.nominal}`,
        );
      }

      /* Pembayaran tidak boleh menggantung di PENDING_VERIFICATION: kalau tetap
         begitu, staf bisa menyetujuinya belakangan dan pesanan yang sudah batal
         berubah jadi lunas. */
      const pembayaran = await api(`/payments/${paymentId}`, {
        token: pesanan.customerToken,
      });
      harapan(pembayaran, 200, 'baca pembayaran setelah pembatalan');
      if (pembayaran.body.data.status !== 'FAILED') {
        throw new Error(
          `pembayaran harus FAILED, menerima ${pembayaran.body.data.status}`,
        );
      }

      /* Armada harus kembali ke katalog. */
      const armada = await api(`/vehicles/${pesanan.booking.vehicleId}`, {
        token: pesanan.customerToken,
      });
      harapan(armada, 200, 'baca armada setelah pembatalan');
      if (armada.body.data.operationalStatus !== 'AVAILABLE') {
        throw new Error(
          `armada harus AVAILABLE, menerima ${armada.body.data.operationalStatus}`,
        );
      }

      /* Staf mencocokkan mutasi bank dan uangnya ternyata ADA. Pembatalan ini
         dilakukan admin, jadi aturan B12 memberi pengembalian penuh — berbeda
         dengan T2.5 yang dibatalkan pelanggan sendiri (dipotong 50.000). */
      const danaMasuk = await api(`/admin/refunds/${refund.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { konfirmasiDana: true },
      });
      harapan(danaMasuk, 200, 'konfirmasi dana masuk');
      if (danaMasuk.body.data.danaTerverifikasi !== true) {
        throw new Error('danaTerverifikasi harus true setelah dikonfirmasi');
      }
      if (Number(danaMasuk.body.data.potongan) !== 0) {
        throw new Error(
          `potongan harus 0 untuk pembatalan oleh admin, menerima ${danaMasuk.body.data.potongan}`,
        );
      }
      if (Number(danaMasuk.body.data.nominal) !== totalAmount) {
        throw new Error(
          `nominal harus ${totalAmount}, menerima ${danaMasuk.body.data.nominal}`,
        );
      }

      /* Konfirmasi kedua harus ditolak: nominal tidak boleh berubah dua kali. */
      const ulang = await api(`/admin/refunds/${refund.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { konfirmasiDana: true },
      });
      harapan(ulang, 409, 'konfirmasi dana dua kali ditolak');

      /* Kasus kedua: uangnya TIDAK ADA di mutasi bank. Barisnya ditutup dengan
         nominal nol supaya antrean tidak menyimpan utang hantu. */
      const kedua = await siapkanPesanan(adminToken);
      harapan(
        await uploadSemuaDokumen(kedua.customerToken, kedua.booking.id),
        200,
        'unggah tiga dokumen (kasus kedua)',
      );
      harapan(
        await verifyDocuments(adminToken, kedua.booking.id, 'APPROVE'),
        200,
        'verifikasi dokumen (kasus kedua)',
      );
      const konfirmasiKedua = await confirmTariff(adminToken, kedua.booking.id);
      if (konfirmasiKedua.status !== 'CONFIRMED') {
        throw new Error(`tarif harus CONFIRMED, menerima ${konfirmasiKedua.status}`);
      }
      const tagihanKedua = await createPayment(kedua.customerToken, kedua.booking.id);
      harapan(tagihanKedua, 201, 'buat tagihan (kasus kedua)');
      harapan(
        await uploadPaymentProof(kedua.customerToken, tagihanKedua.body.data.id),
        200,
        'unggah bukti transfer (kasus kedua)',
      );
      const batalKedua = await api(`/admin/bookings/${kedua.booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'CANCELLED', note: 'Bukti transfer tidak bisa diverifikasi.' },
      });
      harapan(batalKedua, 200, 'batalkan pesanan kedua');
      const refundKedua = batalKedua.body.data.refund;
      if (!refundKedua) {
        throw new Error('pesanan kedua tidak membuat catatan refund');
      }

      const danaTidakAda = await api(`/admin/refunds/${refundKedua.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { konfirmasiDana: false },
      });
      harapan(danaTidakAda, 200, 'konfirmasi dana tidak masuk');
      if (Number(danaTidakAda.body.data.nominal) !== 0) {
        throw new Error(
          `nominal harus 0 saat dana tidak ditemukan, menerima ${danaTidakAda.body.data.nominal}`,
        );
      }
      if (danaTidakAda.body.data.status !== 'SELESAI') {
        throw new Error(
          `baris harus ditutup SELESAI, menerima ${danaTidakAda.body.data.status}`,
        );
      }
    },
  },
  {
    id: 'T6.16',
    nama: 'Pelanggan bisa melengkapi rekening refund setelah membatalkan, tetapi tidak setelah kantor menutupnya',
    async fn({ adminToken }) {
      const pesanan = await siapkanPesananTerbayar(adminToken);

      /* Batal tanpa mengirim rekening: inilah pelanggan yang dulu membatalkan
         lewat versi aplikasi lama, atau yang menutup layar sebelum mengisi. */
      const batal = await api(`/bookings/${pesanan.booking.id}/cancel`, {
        method: 'PATCH',
        token: pesanan.customerToken,
        body: { reason: 'Rencana berubah.' },
      });
      harapan(batal, 200, 'batalkan tanpa rekening');
      const refund = batal.body.data.booking.refund;
      if (!refund) {
        throw new Error('pembatalan tidak membuat catatan refund');
      }
      if (refund.namaBank) {
        throw new Error('rekening seharusnya masih kosong pada pembatalan ini');
      }

      const klaim = await api(`/bookings/${pesanan.booking.id}/refund-account`, {
        method: 'PATCH',
        token: pesanan.customerToken,
        body: {
          refundAccount: {
            bankName: 'Bank Papua',
            accountNumber: '9876543210',
            accountHolderName: 'Yahya Pratama',
          },
        },
      });
      harapan(klaim, 200, 'klaim rekening refund');
      if (klaim.body.data.refund.namaBank !== 'Bank Papua') {
        throw new Error(
          `nama bank harus tersimpan, menerima ${klaim.body.data.refund.namaBank}`,
        );
      }
      if (klaim.body.data.refund.nomorRekening !== '9876543210') {
        throw new Error(
          `nomor rekening harus tersimpan, menerima ${klaim.body.data.refund.nomorRekening}`,
        );
      }

      /* Nomor rekening berisi huruf harus ditolak sebelum disimpan. */
      const salah = await api(`/bookings/${pesanan.booking.id}/refund-account`, {
        method: 'PATCH',
        token: pesanan.customerToken,
        body: {
          refundAccount: {
            bankName: 'Bank Papua',
            accountNumber: '12ab34',
            accountHolderName: 'Yahya Pratama',
          },
        },
      });
      harapan(salah, 400, 'nomor rekening berisi huruf ditolak');

      /* Setelah kantor menutup barisnya, rekening tidak boleh diubah lagi. */
      const tutup = await api(`/admin/refunds/${refund.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'SELESAI', catatan: 'Sudah ditransfer.' },
      });
      harapan(tutup, 200, 'kantor menutup baris refund');

      const setelahTutup = await api(`/bookings/${pesanan.booking.id}/refund-account`, {
        method: 'PATCH',
        token: pesanan.customerToken,
        body: {
          refundAccount: {
            bankName: 'Bank BRI',
            accountNumber: '111222333',
            accountHolderName: 'Yahya Pratama',
          },
        },
      });
      harapan(setelahTutup, 409, 'klaim setelah refund selesai ditolak');
    },
  },
  {
    id: 'T3.1',
    nama: 'Permintaan unggah ulang hanya menyentuh berkas yang dipilih',
    async fn({ adminToken }) {
      const { customerToken, booking } = await siapkanPesanan(adminToken);
      harapan(await uploadSemuaDokumen(customerToken, booking.id), 200, 'unggah tiga dokumen');

      /* Catatan wajib: tanpa catatan pelanggan tidak tahu apa yang salah. */
      const tanpaCatatan = await requestDocumentRevision(adminToken, booking.id, {
        targets: ['KTP'],
      });
      harapan(tanpaCatatan, 400, 'permintaan unggah ulang tanpa catatan ditolak');

      /* Tanpa target dan tanpa "semuaBerkas" juga ditolak. */
      const tanpaTarget = await requestDocumentRevision(adminToken, booking.id, {
        catatan: 'Foto e-KTP dan SIM kurang jelas, mohon difoto ulang di tempat terang.',
      });
      harapan(tanpaTarget, 400, 'permintaan unggah ulang tanpa target ditolak');

      /* Skenario lapangan: staf hanya mempersoalkan dua dari tiga berkas, lalu
         pelanggan mengunggah ulang keduanya. Berkas ketiga tidak boleh hilang. */
      const duaBerkas = await requestDocumentRevision(adminToken, booking.id, {
        catatan: 'Foto e-KTP dan SIM kurang jelas, mohon difoto ulang di tempat terang.',
        targets: ['KTP', 'SIM'],
      });
      harapan(duaBerkas, 200, 'minta unggah ulang dua berkas');

      const setelahMinta = await ambilDokumen(customerToken, booking.id);
      if (JSON.stringify(setelahMinta.rejectionTargets) !== JSON.stringify(['KTP', 'SIM'])) {
        throw new Error(
          `target penolakan harus [KTP,SIM], menerima ${JSON.stringify(setelahMinta.rejectionTargets)}`,
        );
      }
      const suratAwal = setelahMinta.statementLetterUrl;
      if (!suratAwal) {
        throw new Error('surat pernyataan harus tersimpan setelah unggahan pertama');
      }

      /* Unggah ulang satu berkas: SIM masih bermasalah, surat tetap ada. */
      harapan(
        await uploadDocuments(customerToken, booking.id, {
          ktp: await berkasJpeg('ktp-baru.jpg'),
        }),
        200,
        'unggah ulang e-KTP saja',
      );

      const setelahSatu = await ambilDokumen(customerToken, booking.id);
      if (!setelahSatu.statementLetterUrl) {
        throw new Error('surat pernyataan ikut terhapus saat mengunggah ulang e-KTP');
      }
      if (!setelahSatu.simUrl) {
        throw new Error('berkas SIM yang belum diunggah ulang ikut terhapus');
      }
      if (JSON.stringify(setelahSatu.rejectionTargets) !== JSON.stringify(['SIM'])) {
        throw new Error(
          `sisa target harus [SIM], menerima ${JSON.stringify(setelahSatu.rejectionTargets)}`,
        );
      }

      /* Unggah ulang berkas terakhir: semua target selesai, berkas lain utuh. */
      harapan(
        await uploadDocuments(customerToken, booking.id, {
          sim: await berkasJpeg('sim-baru.jpg'),
        }),
        200,
        'unggah ulang SIM',
      );

      const setelahDua = await ambilDokumen(customerToken, booking.id);
      if (!setelahDua.statementLetterUrl || !setelahDua.ktpUrl || !setelahDua.simUrl) {
        throw new Error('salah satu berkas hilang setelah semua diunggah ulang');
      }
      if (setelahDua.rejectionTargets.length !== 0) {
        throw new Error(
          `target penolakan harus kosong, menerima ${JSON.stringify(setelahDua.rejectionTargets)}`,
        );
      }

      /* Status final mengunci aksi dokumen: 409, bukan 200 senyap. */
      harapan(
        await api(`/bookings/${booking.id}/cancel`, {
          method: 'PATCH',
          token: customerToken,
        }),
        200,
        'batalkan pesanan',
      );

      const terkunci = await requestDocumentRevision(adminToken, booking.id, {
        catatan: 'Minta ulang setelah pesanan dibatalkan tidak boleh berpengaruh.',
        semuaBerkas: true,
      });
      pastikanDitolak(terkunci, 409, 'BOOKING_FINAL', 'minta unggah ulang pada pesanan final');
    },
  },
  {
    id: 'T3.3',
    nama: 'Tarif bisa ditetapkan tanpa memilih rute; biaya rute lewat surcharge',
    async fn({ adminToken }) {
      const { customerToken, booking } = await siapkanPesanan(adminToken);
      harapan(await uploadSemuaDokumen(customerToken, booking.id), 200, 'unggah dokumen');
      harapan(await verifyDocuments(adminToken, booking.id, 'APPROVE'), 200, 'setujui dokumen');

      const keAntrean = await api(`/admin/bookings/${booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'PENDING_CONFIRMATION' },
      });
      harapan(keAntrean, 200, 'kirim ke antrean konfirmasi tarif');

      const tanpaRute = await api(`/admin/bookings/${booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'CONFIRMED' },
      });
      harapan(tanpaRute, 200, 'konfirmasi tarif tanpa rute tetap diterima');

      const detail = await api(`/admin/bookings/${booking.id}`, { token: adminToken });
      harapan(detail, 200, 'baca detail pesanan');
      const pesanan = detail.body.data?.booking ?? detail.body.data;
      if (pesanan.status !== 'CONFIRMED') {
        throw new Error(`status harus CONFIRMED, menerima ${pesanan.status}`);
      }
      if (Number(pesanan.quotedAmount) <= 0) {
        throw new Error(`tarif harus terhitung dari katalog, menerima ${pesanan.quotedAmount}`);
      }
    },
  },
  {
    id: 'T3.8',
    nama: 'Permintaan lepas kunci tidak bisa diterima sebelum dokumennya disetujui',
    async fn({ adminToken }) {
      const { customerToken, booking } = await siapkanPesanan(adminToken);

      const sebelumUnggah = await api(`/admin/bookings/${booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'PENDING_CONFIRMATION' },
      });
      pastikanDitolak(sebelumUnggah, 409, 'DOCUMENTS_UNVERIFIED', 'terima tanpa dokumen');

      harapan(await uploadSemuaDokumen(customerToken, booking.id), 200, 'unggah dokumen');
      const sebelumVerifikasi = await api(`/admin/bookings/${booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'PENDING_CONFIRMATION' },
      });
      pastikanDitolak(
        sebelumVerifikasi,
        409,
        'DOCUMENTS_UNVERIFIED',
        'terima saat dokumen belum diperiksa',
      );

      harapan(await verifyDocuments(adminToken, booking.id, 'APPROVE'), 200, 'setujui dokumen');
      const sesudah = await api(`/admin/bookings/${booking.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'PENDING_CONFIRMATION' },
      });
      harapan(sesudah, 200, 'terima setelah dokumen disetujui');
    },
  },
  {
    id: 'T5.1',
    nama: 'Dua admin membalas bersamaan: satu memegang tiket, satu ditolak 409',
    async fn({ adminToken }) {
      const pelanggan = await loginCustomer();
      const tiket = await createTicket(pelanggan.token, {
        title: 'Tiket uji balapan admin',
        description: 'Dua admin akan mencoba menjawab tiket ini pada saat yang sama.',
      });
      harapan(await handoverTiket(adminToken, tiket.id), 200, 'serahkan tiket ke staf');

      const adminKedua = await buatAdminBaru(adminToken, 'ADMIN', 'Admin Uji Balapan');

      const kirim = (token: string) =>
        api(`/admin/tickets/${tiket.id}/messages`, {
          method: 'POST',
          token,
          body: { body: 'Balasan pertama dari admin.' },
        });

      const [a, b] = await Promise.all([kirim(adminToken), kirim(adminKedua.token)]);
      const kode = [a.status, b.status].sort((x, y) => x - y);

      /* Hanya satu yang boleh menang. Kalau keduanya 201, dua admin mengira
         dirinya pemegang tiket dan pelanggan bisa menerima dua jawaban berbeda. */
      if (kode[0] !== 201 || kode[1] !== 409) {
        throw new Error(`harus tepat satu 201 dan satu 409, menerima ${a.status} dan ${b.status}`);
      }

      const pemenang = a.status === 201 ? adminToken : adminKedua.token;
      const detail = await api(`/admin/tickets/${tiket.id}`, { token: pemenang });
      harapan(detail, 200, 'baca tiket setelah balapan');
      if (!detail.body.data?.assignedAdminId) {
        throw new Error('tiket harus dipegang admin yang menang');
      }

      const pesan = (detail.body.data.messages ?? []) as Array<{ body: string }>;
      const balasan = pesan.filter((p) => p.body.includes('Balasan pertama dari admin.'));
      if (balasan.length !== 1) {
        throw new Error(`balasan admin harus tepat satu, menerima ${balasan.length}`);
      }
    },
  },
  {
    id: 'T5.3',
    nama: 'Ambil alih tiket benar-benar berpindah pemegang dan menghentikan AI',
    async fn({ adminToken }) {
      const pelanggan = await loginCustomer();
      const tiket = await createTicket(pelanggan.token, {
        title: 'Tiket uji pengambilalihan',
        description: 'Tiket ini dibuat masih ditangani asisten AI.',
      });

      const staff = await buatAdminBaru(adminToken, 'STAFF', 'Staf Uji Ambil Alih');

      /* STAFF tidak boleh merebut tiket milik orang lain. */
      const olehStaff = await api(`/admin/tickets/${tiket.id}/takeover`, {
        method: 'POST',
        token: staff.token,
      });
      harapan(olehStaff, 403, 'staff tidak boleh mengambil alih');

      const pertama = await api(`/admin/tickets/${tiket.id}/takeover`, {
        method: 'POST',
        token: adminToken,
      });
      harapan(pertama, 200, 'admin mengambil tiket yang masih dipegang AI');
      if (pertama.body.data.assignedAdminId === null) {
        throw new Error('pengambilalihan harus mengisi pemegang tiket');
      }
      if (pertama.body.data.aiDihentikan !== true) {
        throw new Error('AI harus dihentikan saat tiket diambil alih manusia');
      }

      const detail = await api(`/admin/tickets/${tiket.id}`, { token: adminToken });
      harapan(detail, 200, 'baca tiket setelah diambil alih');
      if (detail.body.data.handledBy !== 'HUMAN') {
        throw new Error(`handledBy harus HUMAN, menerima ${detail.body.data.handledBy}`);
      }

      /* Pesan sistem penyerahan + pengambilalihan harus terlihat di riwayat. */
      const isi = ((detail.body.data.messages ?? []) as Array<{ body: string }>)
        .map((p) => p.body)
        .join(' | ');
      if (!isi.includes('diambil alih oleh admin')) {
        throw new Error('riwayat harus memuat pesan pengambilalihan');
      }

      /* Menekan tombol yang sama dua kali tidak boleh berubah jadi galat. */
      const ulang = await api(`/admin/tickets/${tiket.id}/takeover`, {
        method: 'POST',
        token: adminToken,
      });
      harapan(ulang, 200, 'ambil alih ulang oleh pemegang yang sama tetap diterima');
    },
  },
  {
    id: 'T5.4',
    nama: 'Pelanggan menutup tiketnya sendiri berhasil dan pesan penutup tercatat',
    async fn({ adminToken }) {
      const pelanggan = await loginCustomer();
      const tiket = await createTicket(pelanggan.token, {
        title: 'Tiket uji penutupan',
        description: 'Pelanggan akan menutup tiket ini sendiri.',
      });

      const tutup = await api(`/tickets/${tiket.id}/close`, {
        method: 'PATCH',
        token: pelanggan.token,
      });
      harapan(tutup, 200, 'pelanggan menutup tiketnya sendiri');
      if (tutup.body.data.status !== 'CLOSED') {
        throw new Error(`status harus CLOSED, menerima ${tutup.body.data.status}`);
      }

      const detail = await api(`/admin/tickets/${tiket.id}`, { token: adminToken });
      harapan(detail, 200, 'admin membaca tiket yang sudah ditutup');
      if (detail.body.data.status !== 'CLOSED') {
        throw new Error('tiket harus benar-benar tersimpan CLOSED');
      }

      const isi = ((detail.body.data.messages ?? []) as Array<{ body: string }>)
        .map((p) => p.body)
        .join(' | ');
      if (!isi.includes('menutup tiket bantuan ini')) {
        throw new Error('pesan penutup tidak tercatat di riwayat');
      }

      /* Setelah tertutup, balasan baru tetap ditolak supaya tidak menggantung. */
      const telat = await api(`/admin/tickets/${tiket.id}/messages`, {
        method: 'POST',
        token: adminToken,
        body: { body: 'Balasan setelah tiket ditutup.' },
      });
      harapan(telat, 409, 'balasan setelah tiket ditutup ditolak');
    },
  },
  {
    id: 'T5.4b',
    nama: 'Staf tidak bisa menyelesaikan atau menutup tiket secara manual',
    async fn({ adminToken }) {
      const pelanggan = await loginCustomer();
      const tiket = await createTicket(pelanggan.token, {
        title: 'Tiket uji wewenang penutupan',
        description: 'Staf akan mencoba menutup tiket ini secara manual.',
      });

      const staff = await buatAdminBaru(adminToken, 'STAFF', 'Staf Uji Penutupan');
      await handoverTiket(adminToken, tiket.id);

      for (const status of ['RESOLVED', 'CLOSED']) {
        const coba = await api(`/admin/tickets/${tiket.id}/status`, {
          method: 'PATCH',
          token: staff.token,
          body: { status },
        });
        if (coba.status !== 409 || coba.body.error?.code !== 'TICKET_CLOSE_BY_SYSTEM') {
          throw new Error(
            `staf tidak boleh menutup tiket; status ${status} menerima ${coba.status} ${coba.body.error?.code ?? ''}`,
          );
        }
      }

      /* Status bukan akhir tetap boleh diubah staf. */
      const boleh = await api(`/admin/tickets/${tiket.id}/status`, {
        method: 'PATCH',
        token: staff.token,
        body: { status: 'WAITING_CUSTOMER' },
      });
      harapan(boleh, 200, 'staf tetap boleh mengubah status bukan akhir');
    },
  },
  {
    id: 'T5.6',
    nama: 'Kategori FAQ bisa diganti namanya dan dihapus hanya setelah FAQ dipindahkan',
    async fn({ adminToken }) {
      const buat = async (kategori: string, pertanyaan: string) => {
        const respons = await api('/admin/faqs', {
          method: 'POST',
          token: adminToken,
          body: {
            question: pertanyaan,
            answer: 'Jawaban pengujian kategori.',
            category: kategori,
            orderIndex: 0,
            isActive: true,
          },
        });
        harapan(respons, 201, `buat FAQ kategori ${kategori}`);
        return respons.body.data?.id as string;
      };

      const idA = await buat('Kategori Uji Lama', 'Pertanyaan pertama kategori uji.');
      await buat('Kategori Uji Lama', 'Pertanyaan kedua kategori uji.');
      const idTujuan = await buat('Kategori Uji Tujuan', 'Pertanyaan kategori tujuan.');

      const daftar = await api('/admin/faqs/categories', { token: adminToken });
      harapan(daftar, 200, 'daftar kategori');
      const kategori = (daftar.body.data as Array<{ category: string; jumlah: number }>).find(
        (k) => k.category === 'Kategori Uji Lama',
      );
      if (!kategori || kategori.jumlah !== 2) {
        throw new Error(`kategori harus terhitung 2 FAQ, menerima ${kategori?.jumlah}`);
      }

      /* Menghapus tanpa kategori tujuan ditolak: FAQ tidak boleh ikut hilang. */
      const hapusTanpaTujuan = await api(
        `/admin/faqs/categories/${encodeURIComponent('Kategori Uji Lama')}`,
        { method: 'DELETE', token: adminToken },
      );
      if (hapusTanpaTujuan.status !== 409) {
        throw new Error(`hapus kategori terpakai harus 409, menerima ${hapusTanpaTujuan.status}`);
      }

      const pindah = await api(
        `/admin/faqs/categories/${encodeURIComponent('Kategori Uji Lama')}?pindahkanKe=${encodeURIComponent('Kategori Uji Tujuan')}`,
        { method: 'DELETE', token: adminToken },
      );
      harapan(pindah, 200, 'hapus kategori dengan memindahkan FAQ');

      const detailA = await api(`/admin/faqs/${idA}`, { token: adminToken });
      harapan(detailA, 200, 'baca FAQ yang dipindahkan');
      if (detailA.body.data.category !== 'Kategori Uji Tujuan') {
        throw new Error(`FAQ harus pindah kategori, menerima ${detailA.body.data.category}`);
      }

      const hapusTujuan = await api(
        `/admin/faqs/categories/${encodeURIComponent('Kategori Uji Tujuan')}?pindahkanKe=${encodeURIComponent('Kategori Uji Akhir')}`,
        { method: 'DELETE', token: adminToken },
      );
      harapan(hapusTujuan, 200, 'hapus kategori tujuan dengan memindahkan FAQ-nya');

      const detailTujuan = await api(`/admin/faqs/${idTujuan}`, { token: adminToken });
      harapan(detailTujuan, 200, 'baca FAQ kategori akhir');
      if (detailTujuan.body.data.category !== 'Kategori Uji Akhir') {
        throw new Error(`FAQ harus pindah ke Kategori Uji Akhir, menerima ${detailTujuan.body.data.category}`);
      }
    },
  },
  {
    id: 'T5.8',
    nama: 'Staf tidak bisa menyentuh jalur khusus admin',
    async fn({ adminToken }) {
      const staf = await buatAdminBaru(adminToken, 'STAFF', 'Staf Uji Peran');
      const pelanggan = await loginCustomer();

      const daftarPelanggan = await api(
        `/admin/customers?search=${encodeURIComponent(pelanggan.phone)}`,
        { token: adminToken },
      );
      harapan(daftarPelanggan, 200, 'cari pelanggan uji');
      const barisPelanggan = (daftarPelanggan.body.data?.items ??
        daftarPelanggan.body.data) as Array<{ id: string; phoneNumber: string }>;
      const pelangganId = barisPelanggan.find((p) => p.phoneNumber === pelanggan.phone)?.id;
      if (!pelangganId) throw new Error('pelanggan uji tidak ditemukan di daftar admin');

      /* Daftar akun pengelola: staf tidak perlu melihat daftar admin lain,
         apalagi mengganti sandinya. */
      const daftarStaf = await api('/admin/users', { token: staf.token });
      if (daftarStaf.status !== 403) {
        throw new Error(`staf membuka daftar admin harus 403, menerima ${daftarStaf.status}`);
      }

      /* Koreksi nama pelanggan menyentuh data identitas yang dipakai dokumen
         sewa, jadi hanya ADMIN. */
      const koreksiNama = await api(`/admin/customers/${pelangganId}/name`, {
        method: 'PATCH',
        token: staf.token,
        body: { fullName: 'Nama Diubah Staf', reason: 'Pengujian kewenangan staf.' },
      });
      if (koreksiNama.status !== 403) {
        throw new Error(`staf mengoreksi nama pelanggan harus 403, menerima ${koreksiNama.status}`);
      }

      /* Yang memang menjadi tugas staf harus tetap jalan. */
      const bukaKunci = await api(`/admin/customers/${pelangganId}/unlock`, {
        method: 'POST',
        token: staf.token,
        body: { reason: 'Pengujian kewenangan staf.' },
      });
      harapan(bukaKunci, 200, 'staf tetap boleh membuka kunci akun pelanggan');

      const ubahTarif = await api('/admin/fleet/tariff-settings', {
        method: 'PATCH',
        token: staf.token,
        body: { driverDailyRate: 150000 },
      });
      if (ubahTarif.status !== 403) {
        throw new Error(`staf mengubah tarif global harus 403, menerima ${ubahTarif.status}`);
      }

      const bacaTarif = await api('/admin/fleet/tariff-settings', { token: staf.token });
      harapan(bacaTarif, 200, 'staf tetap boleh membaca tarif global');
    },
  },
  {
    id: 'T5.9',
    nama: 'Isian yang kepanjangan ditolak sebelum disimpan',
    async fn({ adminToken }) {
      const namaPanjang = 'N'.repeat(101);
      const gantiNama = await api('/me', {
        method: 'PATCH',
        token: (await loginCustomer()).token,
        body: { fullName: namaPanjang },
      });
      if (gantiNama.status !== 400) {
        throw new Error(`nama 101 karakter harus 400, menerima ${gantiNama.status}`);
      }

      const catatanPanjang = 'C'.repeat(501);
      const pelanggan = await loginCustomer();
      const kendaraan = await createVehicle(adminToken);
      const pesanan = await createBooking(pelanggan.token, kendaraan.id);
      const tagihan = await createPayment(pelanggan.token, pesanan.id, {
        notes: catatanPanjang,
      });
      if (tagihan.status !== 400) {
        throw new Error(`catatan tagihan 501 karakter harus 400, menerima ${tagihan.status}`);
      }

      const satuanPanjang = await api('/admin/vehicles', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'X'.repeat(121),
          licensePlate: 'ZZ 9999 QQ',
          pricePerDay: 300000,
        },
      });
      if (satuanPanjang.status !== 400) {
        throw new Error(`nama armada 121 karakter harus 400, menerima ${satuanPanjang.status}`);
      }
    },
  },
  {
    id: 'T5.10',
    nama: 'Teks bertanda HTML disimpan apa adanya dan tidak dijalankan server',
    async fn({ adminToken }) {
      const muatan = '<img src=x onerror="alert(1)">';
      const pelanggan = await loginCustomer();
      const tiket = await createTicket(pelanggan.token, {
        title: `Coba ${muatan}`,
        description: `Deskripsi ${muatan} selesai.`,
      });

      const pesan = await api(`/tickets/${tiket.id}/messages`, {
        method: 'POST',
        token: pelanggan.token,
        body: { body: muatan },
      });
      harapan(pesan, 201, 'kirim pesan bertanda HTML');

      const detail = await api(`/tickets/${tiket.id}`, { token: adminToken });
      harapan(detail, 200, 'baca detail tiket');

      /* Server menyimpan teks apa adanya dan mengirimkannya di dalam JSON.
         Tidak ada satu pun jalur yang menafsirkannya sebagai HTML: dashboard
         memakai React (yang meng-escape teks di dalam elemen) dan aplikasi
         pelanggan memakai widget Text. Kalau suatu saat ada yang menempelkan
         isi ini ke innerHTML, test ini tetap lulus — karena itu berkas ini
         bukan pengganti pemeriksaan kode, melainkan penjaga bentuk data. */
      const teks = JSON.stringify(detail.body);
      if (!teks.includes('onerror')) {
        throw new Error('isi pesan hilang saat disimpan atau dibaca');
      }
      if (teks.includes('<script')) {
        throw new Error('server tidak boleh menambahkan markup sendiri');
      }
    },
  },
  {
    id: 'T5.11',
    nama: 'Unggahan berkas yang terlalu sering ditahan dan tercatat di audit log',
    async fn({ adminToken }) {
      const { customerToken, booking } = await siapkanPesanan(adminToken);
      const berkas = await berkasJpeg('ktp.jpg');

      /*
       * Harness menurunkan batas unggahan menjadi 5 per 10 menit. Lima unggahan
       * pertama tetap harus 200; yang keenam harus ditahan, bukan diproses.
       */
      for (let i = 0; i < 5; i += 1) {
        const unggah = await uploadDocuments(customerToken, booking.id, { ktp: berkas });
        harapan(unggah, 200, `unggah berkas ke-${i + 1}`);
      }

      const keenam = await uploadDocuments(customerToken, booking.id, { ktp: berkas });
      pastikanDitolak(keenam, 429, 'UPLOAD_RATE_LIMITED', 'unggahan berkas keenam');

      /* Audit ditulis tanpa ditunggu, jadi diberi waktu singkat sebelum dibaca. */
      let baris: Array<{ action: string }> = [];
      for (let i = 0; i < 10 && baris.length === 0; i += 1) {
        baris = await sqlUji<Array<{ action: string }>>(
          'SELECT action FROM audit_logs WHERE action = ? LIMIT 1',
          ['UPLOAD_RATE_LIMITED'],
        );
        if (baris.length === 0) {
          await new Promise((selesai) => setTimeout(selesai, 100));
        }
      }
      if (baris.length === 0) {
        throw new Error('penolakan unggahan tidak tercatat di audit_logs');
      }
    },
  },
  {
    id: 'T6.20',
    nama: 'Tombol chat pesanan membuka satu tiket berisi ringkasan sewa',
    async fn({ adminToken }) {
      const { customerToken, booking } = await siapkanPesanan(adminToken);

      const pertama = await api(`/tickets/booking/${booking.id}`, {
        method: 'POST',
        token: customerToken,
      });
      harapan(pertama, 201, 'buka tiket pesanan');

      const tiket = pertama.body.data;
      if (tiket.bookingId !== booking.id) {
        throw new Error('tiket tidak menyimpan tautan ke pesanan');
      }
      if (tiket.handledBy !== 'AI') {
        throw new Error(`tiket pesanan harus dibuka asisten, bukan ${tiket.handledBy}`);
      }

      const pesanPembuka = tiket.messages?.[0];
      if (!pesanPembuka) {
        throw new Error('tiket pesanan dibuat tanpa pesan pembuka');
      }
      if (!pesanPembuka.isAi) {
        throw new Error('pesan pembuka harus ditulis asisten');
      }
      if (!pesanPembuka.body.includes(booking.bookingCode)) {
        throw new Error('pesan pembuka tidak menyebut kode pesanan');
      }
      if (!pesanPembuka.body.includes(booking.vehicle.name)) {
        throw new Error('pesan pembuka tidak menyebut unit yang disewa');
      }
      if (!pesanPembuka.body.includes('0812-3456-7890')) {
        throw new Error('pesan pembuka tidak memuat nomor kantor');
      }

      /* Menekan tombol lagi tidak boleh membuat percakapan kedua. */
      const kedua = await api(`/tickets/booking/${booking.id}`, {
        method: 'POST',
        token: customerToken,
      });
      harapan(kedua, 200, 'buka tiket pesanan kedua kali');
      if (kedua.body.data.id !== tiket.id) {
        throw new Error('tombol yang ditekan dua kali membuat tiket baru');
      }
      if (kedua.body.data.dipakaiUlang !== true) {
        throw new Error('respons kedua harus menandai tiket dipakai ulang');
      }

      /* Pesanan milik orang lain tidak boleh dibuka. */
      const pelangganLain = await loginCustomer();
      const pesananOrangLain = await api(`/tickets/booking/${booking.id}`, {
        method: 'POST',
        token: pelangganLain.token,
      });
      pastikanDitolak(pesananOrangLain, 404, 'BOOKING_NOT_FOUND', 'tiket pesanan orang lain');
    },
  },
];

function ambilFilterOnly(): Set<string> | null {
  const argumen = process.argv.find((arg) => arg.startsWith('--only='));
  if (!argumen) return null;

  const nilai = argumen.slice('--only='.length).trim();
  if (!nilai) return null;
  return new Set(
    nilai
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function cetakTabel(hasil: HasilKasus[]): void {
  const lebarId = Math.max(4, ...hasil.map((h) => h.id.length));
  const lebarNama = Math.max(5, ...hasil.map((h) => h.nama.length));
  const lebarStatus = 5;
  const lebarDurasi = 8;

  const garis = `+-${'-'.repeat(lebarId)}-+-${'-'.repeat(lebarStatus)}-+-${'-'.repeat(lebarDurasi)}-+-${'-'.repeat(lebarNama)}-+`;
  console.log('\nHasil E2E');
  console.log(garis);
  console.log(
    `| ${'ID'.padEnd(lebarId)} | ${'STATUS'.padEnd(lebarStatus)} | ${'DURASI'.padEnd(lebarDurasi)} | ${'KASUS'.padEnd(lebarNama)} |`,
  );
  console.log(garis);
  for (const h of hasil) {
    console.log(
      `| ${h.id.padEnd(lebarId)} | ${(h.lulus ? 'LULUS' : 'GAGAL').padEnd(lebarStatus)} | ` +
        `${`${h.durasiMs} ms`.padEnd(lebarDurasi)} | ${h.nama.padEnd(lebarNama)} |`,
    );
  }
  console.log(garis);
}

function cetakDetailGagal(hasil: HasilKasus[]): void {
  const gagal = hasil.filter((h) => !h.lulus);
  if (gagal.length === 0) return;

  console.log('\nDetail kegagalan:');
  for (const h of gagal) {
    console.log(`\n[${h.id}] ${h.nama}`);
    console.log(`  ${(h.error ?? 'tanpa pesan').replace(/\n/g, '\n  ')}`);
  }
}

async function main(): Promise<void> {
  const filter = ambilFilterOnly();
  const dipilih = filter ? kasus.filter((k) => filter.has(k.id)) : kasus;

  if (dipilih.length === 0) {
    console.error(
      `Tidak ada kasus yang cocok dengan --only. ID tersedia: ${kasus.map((k) => k.id).join(', ')}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log('Menyiapkan harness E2E...');
  await startHarness();

  const hasil: HasilKasus[] = [];
  let adminToken = '';

  try {
    adminToken = await loginAdmin();
  } catch (error) {
    console.error('Gagal login admin; kasus tidak dapat dijalankan.');
    console.error(error instanceof Error ? error.message : error);
    await stopServer();
    process.exitCode = 1;
    return;
  }

  let sudahDihentikan = false;
  const hentikan = async (): Promise<void> => {
    if (sudahDihentikan) return;
    sudahDihentikan = true;
    await stopServer();
  };

  const tanganiSinyal = (): void => {
    void hentikan().finally(() => process.exit(130));
  };
  process.once('SIGINT', tanganiSinyal);
  process.once('SIGTERM', tanganiSinyal);

  try {
    for (const k of dipilih) {
      console.log(`\n[${k.id}] ${k.nama}`);
      const mulai = performance.now();
      let lulus = true;
      let pesan: string | undefined;

      try {
        await k.fn({ adminToken });
        console.log(`  LULUS (${Math.round(performance.now() - mulai)} ms)`);
      } catch (error) {
        lulus = false;
        pesan = error instanceof Error ? error.message : String(error);
        console.log(`  GAGAL: ${pesan}`);
      }

      hasil.push({
        id: k.id,
        nama: k.nama,
        lulus,
        durasiMs: Math.round(performance.now() - mulai),
        error: pesan,
      });
    }
  } finally {
    await hentikan();
  }

  cetakTabel(hasil);
  cetakDetailGagal(hasil);

  const jumlahLulus = hasil.filter((h) => h.lulus).length;
  const jumlahGagal = hasil.length - jumlahLulus;
  console.log(`\nLULUS: ${jumlahLulus}  GAGAL: ${jumlahGagal}  TOTAL: ${hasil.length}`);
  process.exitCode = jumlahGagal > 0 ? 1 : 0;
}

main().catch(async (error) => {
  console.error('\nHarness E2E gagal dijalankan:');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  await stopServer().catch(() => {});
  process.exitCode = 1;
});
