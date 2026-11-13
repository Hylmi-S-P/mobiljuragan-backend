import sharp from 'sharp';
import { BASE_URL } from './harness.js';

/*
 * Fixture HTTP untuk harness E2E.
 *
 * Semua helper memeriksa status yang diharapkan dan melempar galat yang memuat
 * status + isi respons. Tanpa itu, kegagalan di tengah alur hanya terlihat
 * sebagai "undefined" dan penyebabnya harus ditebak dari log server.
 */

export interface ResponsApi {
  status: number;
  // Body bisa JSON atau teks; pemanggil yang tahu bentuk responsnya.
  body: any;
}

interface OpsiPermintaan {
  method?: string;
  token?: string;
  body?: unknown;
  formData?: FormData;
}

export async function api(path: string, opsi: OpsiPermintaan = {}): Promise<ResponsApi> {
  const headers: Record<string, string> = {};
  if (opsi.token) {
    headers.Authorization = `Bearer ${opsi.token}`;
  }

  let payload: string | FormData | undefined;
  if (opsi.formData) {
    payload = opsi.formData;
  } else if (opsi.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(opsi.body);
  }

  const respons = await fetch(`${BASE_URL}${path}`, {
    method: opsi.method ?? 'GET',
    headers,
    body: payload,
  });

  const teks = await respons.text();
  let body: any = teks;
  if (teks.length > 0) {
    try {
      body = JSON.parse(teks);
    } catch {
      // Respons non-JSON (mis. halaman galat proxy) dibiarkan sebagai teks.
    }
  }

  return { status: respons.status, body };
}

/** Memastikan respons berstatus tertentu; kalau tidak, galat memuat detailnya. */
export function harapan(
  respons: ResponsApi,
  status: number | number[],
  konteks: string,
): void {
  const diterima = Array.isArray(status) ? status : [status];
  if (diterima.includes(respons.status)) return;

  const kode = respons.body?.error?.code ?? 'tanpa-kode';
  const pesan = respons.body?.error?.message ?? JSON.stringify(respons.body);
  throw new Error(
    `${konteks}: diharapkan HTTP ${diterima.join('/')} tetapi menerima ${respons.status} ` +
      `[${kode}] ${pesan}`,
  );
}

/** Nomor HP unik per kasus supaya run berulang tidak bentrok dengan data lama. */
export function nomorHpUnik(): string {
  const acak = Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, '0');
  return `0812${acak}`;
}

/** Login admin hasil seed; token dipakai bersama oleh seluruh kasus. */
export async function loginAdmin(): Promise<string> {
  const respons = await api('/admin/auth/login', {
    method: 'POST',
    body: { phoneNumber: '081234567890', password: 'Admin123!' },
  });
  harapan(respons, 200, 'login admin');
  return respons.body.data.token as string;
}

/**
 * Membuat pelanggan baru sekaligus login lewat alur OTP register.
 *
 * Nomor harus baru: OTP untuk intent `register` pada nomor yang sudah terdaftar
 * ditolak 409. Kode `123456` hanya berlaku ketika ALLOW_DEV_OTP_BYPASS aktif,
 * dan harness selalu menyalakannya untuk server uji.
 */
export async function loginCustomer(
  phone: string = nomorHpUnik(),
): Promise<{ token: string; phone: string }> {
  const minta = await api('/auth/otp/request', {
    method: 'POST',
    body: { phoneNumber: phone, intent: 'register' },
  });
  harapan(minta, 200, `minta OTP register ${phone}`);

  const verifikasi = await api('/auth/register/verify', {
    method: 'POST',
    body: {
      phoneNumber: phone,
      otp: '123456',
      fullName: 'Pelanggan Uji',
      password: 'Pelanggan123!',
    },
  });
  harapan(verifikasi, 201, `verifikasi OTP register ${phone}`);

  return { token: verifikasi.body.data.token as string, phone };
}

export async function createVehicle(
  adminToken: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const akhiran = Math.random().toString(36).slice(2, 7).toUpperCase();
  const nomorPlat = Math.floor(1000 + Math.random() * 9000);
  const payload = {
    name: `Toyota Avanza ${akhiran}`,
    licensePlate: `B ${nomorPlat} ${akhiran}`,
    category: 'MPV',
    transmission: 'AUTOMATIC',
    seatingCapacity: 7,
    pricePerDay: 350_000,
    brand: 'Toyota',
    model: 'Avanza',
    operationalStatus: 'AVAILABLE',
    ...overrides,
  };

  const respons = await api('/admin/vehicles', {
    method: 'POST',
    token: adminToken,
    body: payload,
  });
  harapan(respons, 201, 'buat armada');
  return respons.body.data;
}

/** Supir baru selalu berstatus SIAGA sehingga bisa langsung ditugaskan. */
export async function createDriver(
  adminToken: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const akhiran = Math.random().toString(36).slice(2, 7).toUpperCase();
  const payload = {
    fullName: `Supir Uji ${akhiran}`,
    phoneNumber: nomorHpUnik(),
    routeScope: 'DALAM_KOTA',
    ...overrides,
  };

  const respons = await api('/admin/drivers', {
    method: 'POST',
    token: adminToken,
    body: payload,
  });
  harapan(respons, 201, 'buat supir');
  return respons.body.data;
}

/** Menugaskan supir ke pesanan; dipakai kasus yang menguji tarif bersupir. */
export async function assignDriver(
  adminToken: string,
  bookingId: string,
  driverId: string,
): Promise<any> {
  const respons = await api(`/admin/bookings/${bookingId}/driver`, {
    method: 'PATCH',
    token: adminToken,
    body: { driverId },
  });
  harapan(respons, 200, 'tugaskan supir');
  return respons.body.data;
}

/** Jendela sewa yang selalu di masa depan dan tidak bertabrakan antar-kasus. */export function jendelaSewa(): { startDateTime: string; endDateTime: string } {
  const mulai = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const selesai = new Date(mulai.getTime() + 2 * 24 * 60 * 60 * 1000);
  return { startDateTime: mulai.toISOString(), endDateTime: selesai.toISOString() };
}

export async function createBooking(
  customerToken: string,
  vehicleId: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const payload = {
    vehicleId,
    rentalType: 'WITHOUT_DRIVER',
    pickupLocation: 'Bandara Juanda',
    numberGuests: 2,
    ...jendelaSewa(),
    ...overrides,
  };

  const respons = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: payload,
  });
  harapan(respons, 201, 'buat pesanan');
  return respons.body.data;
}

export type FieldDokumen = 'statementLetter' | 'ktp' | 'sim';

export interface BerkasUji {
  buffer: Buffer;
  filename: string;
  mime: string;
}

let cacheJpeg: Buffer | null = null;

/** JPEG 100x100 yang valid; dibuat sekali karena sharp relatif mahal. */
export async function jpegKecil(): Promise<Buffer> {
  if (!cacheJpeg) {
    cacheJpeg = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 200, g: 80, b: 40 },
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
  return cacheJpeg;
}

export async function berkasJpeg(nama = 'dokumen.jpg'): Promise<BerkasUji> {
  return { buffer: await jpegKecil(), filename: nama, mime: 'image/jpeg' };
}

/** Byte PDF palsu; cukup untuk membuktikan penolakan berbasis magic bytes. */
export function berkasPdf(nama = 'dokumen.pdf'): BerkasUji {
  return {
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n'),
    filename: nama,
    mime: 'application/pdf',
  };
}

/**
 * JPEG yang melewati batas 5 MB.
 *
 * Isinya bukan gambar sungguhan karena multer menolak berdasarkan ukuran
 * sebelum isi berkas dibaca; yang diuji adalah batas ukuran, bukan validitas
 * gambar.
 */
export function berkasKebesaran(nama = 'kebesaran.jpg'): BerkasUji {
  const buffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0x20);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xe0;
  return { buffer, filename: nama, mime: 'image/jpeg' };
}

export async function uploadDocuments(
  customerToken: string,
  bookingId: string,
  files: Partial<Record<FieldDokumen, BerkasUji>>,
): Promise<ResponsApi> {
  const formData = new FormData();
  for (const [field, berkas] of Object.entries(files)) {
    if (!berkas) continue;
    formData.append(
      field,
      new Blob([new Uint8Array(berkas.buffer)], { type: berkas.mime }),
      berkas.filename,
    );
  }

  return api(`/bookings/${bookingId}/documents`, {
    method: 'POST',
    token: customerToken,
    formData,
  });
}

/** Unggah ketiga dokumen wajib dengan JPEG valid. */
export async function uploadSemuaDokumen(
  customerToken: string,
  bookingId: string,
): Promise<ResponsApi> {
  return uploadDocuments(customerToken, bookingId, {
    statementLetter: await berkasJpeg('surat-pernyataan.jpg'),
    ktp: await berkasJpeg('ktp.jpg'),
    sim: await berkasJpeg('sim.jpg'),
  });
}

export async function verifyDocuments(
  adminToken: string,
  bookingId: string,
  action: 'APPROVE' | 'REJECT',
  targets?: string[],
): Promise<ResponsApi> {
  const body: Record<string, unknown> = { action };
  if (action === 'REJECT') {
    body.rejectionReason = 'Dokumen kurang jelas.';
    body.targets = targets ?? [];
  }

  return api(`/admin/bookings/${bookingId}/documents/verify`, {
    method: 'PATCH',
    token: adminToken,
    body,
  });
}

/**
 * Mengonfirmasi tarif.
 *
 * Status CREATED tidak boleh langsung ke CONFIRMED; alurnya harus melewati
 * PENDING_CONFIRMATION. Helper ini menempuh dua langkah itu supaya pemanggil
 * tidak perlu mengulang detail transisi di setiap kasus.
 *
 * Nominal tarif tidak lagi dikirim dari klien: server menghitungnya dari harga
 * katalog unit ditambah tarif supir global.
 */
export async function confirmTariff(
  adminToken: string,
  bookingId: string,
  payload: { routeScope?: string; note?: string } = {},
): Promise<any> {
  const pending = await api(`/admin/bookings/${bookingId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'PENDING_CONFIRMATION' },
  });
  harapan(pending, 200, 'ubah status ke PENDING_CONFIRMATION');

  const konfirmasi = await api(`/admin/bookings/${bookingId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      status: 'CONFIRMED',
      ...(payload.routeScope ? { routeScope: payload.routeScope } : {}),
      ...(payload.note ? { note: payload.note } : {}),
    },
  });
  harapan(konfirmasi, 200, 'konfirmasi tarif');
  return konfirmasi.body.data;
}

/** Serah armada: model memakai transisi IN_PROGRESS dan mensyaratkan lunas. */
export async function handover(adminToken: string, bookingId: string): Promise<ResponsApi> {
  return api(`/admin/bookings/${bookingId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'IN_PROGRESS' },
  });
}

export async function createPayment(
  customerToken: string,
  bookingId: string,
  overrides: Record<string, unknown> = {},
): Promise<ResponsApi> {
  return api('/payments', {
    method: 'POST',
    token: customerToken,
    body: { bookingId, method: 'QRIS', ...overrides },
  });
}

/**
 * Mengunggah bukti transfer sebagai data URL gambar.
 *
 * Server tetap memproses isinya lewat sharp; data URL hanya bentuk transport,
 * bukan izin menyimpan berkas mentah.
 */
export async function uploadPaymentProof(
  customerToken: string,
  paymentId: string,
  senderAccount = 'Pelanggan Uji',
): Promise<ResponsApi> {
  const gambar = await jpegKecil();
  const proofImageUrl = `data:image/jpeg;base64,${gambar.toString('base64')}`;
  return api(`/payments/${paymentId}/proof`, {
    method: 'POST',
    token: customerToken,
    body: { proofImageUrl, senderAccount, bankName: 'BCA' },
  });
}

export async function verifyPayment(
  adminToken: string,
  paymentId: string,
  action: 'APPROVE' | 'REJECT',
): Promise<ResponsApi> {
  return api(`/admin/payments/${paymentId}/verify`, {
    method: 'PATCH',
    token: adminToken,
    body: { action },
  });
}

export async function createTicket(
  customerToken: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const respons = await api('/tickets', {
    method: 'POST',
    token: customerToken,
    body: {
      title: 'Kendala pengujian',
      description: 'Tiket dibuat oleh harness E2E.',
      ...overrides,
    },
  });
  harapan(respons, 201, 'buat tiket');
  return respons.body.data;
}

export async function closeTicket(customerToken: string, ticketId: string): Promise<void> {
  const respons = await api(`/tickets/${ticketId}/close`, {
    method: 'PATCH',
    token: customerToken,
  });
  harapan(respons, 200, 'tutup tiket');
}
