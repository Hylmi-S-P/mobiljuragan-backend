import { BASE_ORIGIN, startHarness, stopServer } from './harness.js';
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
  uploadSemuaDokumen,
  verifyDocuments,
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
