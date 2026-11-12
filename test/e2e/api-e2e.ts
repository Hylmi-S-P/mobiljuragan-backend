import { BASE_ORIGIN, sqlUji, startHarness, stopServer } from './harness.js';
import {
  api,
  berkasJpeg,
  berkasKebesaran,
  berkasPdf,
  confirmTariff,
  createBooking,
  createPayment,
  createTicket,
  createVehicle,
  harapan,
  handover,
  loginAdmin,
  loginCustomer,
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

      const tutup = await api(`/admin/tickets/${tiket.id}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'RESOLVED' },
      });
      harapan(tutup, 200, 'admin menandai tiket selesai');

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
