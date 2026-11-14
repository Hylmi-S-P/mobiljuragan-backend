import { toInternationalPhone } from '../lib/phone.js';
import { logger } from '../logger.js';

/**
 * Pengiriman pesan WhatsApp.
 *
 * Dua kebutuhan memakai berkas ini:
 * 1. kode OTP saat masuk/daftar/pemulihan kata sandi;
 * 2. pemberitahuan ke pemilik akun saat identitasnya berubah.
 *
 * Yang kedua bukan pelengkap. Kalau nama atau nomor seseorang diganti tanpa
 * sepengetahuannya, pesan itulah satu-satunya cara ia tahu dan bisa melapor.
 *
 * Ada dua penyedia yang didukung untuk OTP:
 * - `wapi`  — WaPi.io, endpoint `POST /otp/send` (template OTP, biaya per pesan).
 * - `gowa`  — gateway WhatsApp Web multidevice, endpoint `POST /send/message`
 *             (teks bebas, termasuk pesan pemberitahuan identitas).
 *
 * Pesan teks bebas (pemberitahuan identitas) selalu lewat `gowa`, karena
 * endpoint OTP WaPi.io hanya mengirim template, bukan teks yang kita susun.
 */

export interface SendWhatsAppOtpOptions {
  phoneNumber: string;
  otpCode: string;
  fullName?: string;
}

type JenisPesan = 'OTP' | 'NOTIFIKASI';

type PenyediaOtp = 'wapi' | 'gowa' | 'off';

interface KonfigurasiGateway {
  endpoint: string;
  deviceId: string;
  headers: Record<string, string>;
}

/**
 * Menentukan penyedia OTP yang dipakai.
 *
 * `WA_PROVIDER` boleh diisi eksplisit (`wapi`, `gowa`, `off`). Bila kosong,
 * penyedia ditebak dari variabel yang terisi: kunci WaPi lebih dulu, lalu
 * gateway GOWA. Dengan begitu `.env` lama tetap jalan tanpa perubahan.
 */
function penyediaOtp(): PenyediaOtp {
  const eksplisit = process.env.WA_PROVIDER?.trim().toLowerCase();
  if (eksplisit === 'wapi' || eksplisit === 'gowa' || eksplisit === 'off') {
    return eksplisit;
  }
  if (process.env.WAPI_API_KEY?.trim()) return 'wapi';
  if (process.env.WA_GATEWAY_URL?.trim()) return 'gowa';
  return 'off';
}

/**
 * Menyiapkan konfigurasi gateway GOWA, atau null bila belum disetel.
 *
 * Tidak pernah melempar galat: pemanggil memutuskan sendiri apakah kegagalan
 * pengiriman harus menggagalkan alur utama (biasanya tidak — OTP tetap
 * tersimpan dan bisa dikirim ulang).
 */
function siapkanGateway(jenis: JenisPesan, phoneNumber: string): KonfigurasiGateway | null {
  const gatewayUrl = process.env.WA_GATEWAY_URL?.trim();
  if (!gatewayUrl) {
    logger.warn(
      { phoneNumber, jenis },
      '[WA] WA_GATEWAY_URL belum disetel di .env. Pengiriman WhatsApp dilewati.',
    );
    return null;
  }

  const deviceId =
    process.env.WA_GATEWAY_DEVICE_ID?.trim() || '6729527b-ecb0-4e58-87a4-2d954c682c6c';
  const username = process.env.WA_GATEWAY_USER?.trim();
  const password = process.env.WA_GATEWAY_PASSWORD?.trim();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId,
  };

  if (username && password) {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  return {
    endpoint: `${gatewayUrl.replace(/\/+$/, '')}/send/message`,
    deviceId,
    headers,
  };
}

/** Mengirim satu pesan teks bebas lewat gateway GOWA. */
async function kirimPesanWhatsApp({
  phoneNumber,
  pesan,
  jenis,
}: {
  phoneNumber: string;
  pesan: string;
  jenis: JenisPesan;
}): Promise<boolean> {
  const gateway = siapkanGateway(jenis, phoneNumber);
  if (!gateway) return false;

  const internationalPhone = toInternationalPhone(phoneNumber);

  try {
    logger.info(
      { target: internationalPhone, deviceId: gateway.deviceId, jenis },
      `[WA ${jenis}] Mengirim pesan via WhatsApp Gateway...`,
    );

    const response = await fetch(gateway.endpoint, {
      method: 'POST',
      headers: gateway.headers,
      body: JSON.stringify({ phone: internationalPhone, message: pesan }),
      signal: AbortSignal.timeout(10000),
    });

    const responseData = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      logger.error(
        { status: response.status, responseData, target: internationalPhone, jenis },
        `[WA ${jenis}] Gateway menolak permintaan.`,
      );
      return false;
    }

    logger.info({ target: internationalPhone, jenis }, `[WA ${jenis}] Pesan terkirim.`);
    return true;
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : err, target: internationalPhone, jenis },
      `[WA ${jenis}] Gagal memanggil WhatsApp Gateway.`,
    );
    return false;
  }
}

/**
 * Menerjemahkan kode galat WaPi.io menjadi kalimat yang bisa ditindaklanjuti.
 *
 * Tanpa ini, kegagalan pengiriman hanya tampil sebagai "gagal" dan orang harus
 * menebak apakah masalahnya kunci, saldo, atau endpoint yang belum aktif.
 */
function jelaskanGalatWapi(status: number, kode: string | undefined): string {
  switch (kode) {
    case 'INVALID_API_KEY':
      return 'Kunci API WaPi.io ditolak. Periksa WAPI_API_KEY di .env.';
    case 'INSUFFICIENT_CREDITS':
      return 'Saldo kredit WaPi.io habis. Lakukan top-up di konsol billing.';
    case 'RATE_LIMIT_EXCEEDED':
      return 'Batas laju WaPi.io terlampaui (atau nomor tujuan sedang dibatasi).';
    case 'ENGINE_OFFLINE':
      return 'Mesin WhatsApp WaPi.io sedang offline. Coba lagi beberapa saat.';
    case 'ROUTE_NOT_FOUND':
      return 'Endpoint outbound OTP belum aktif di server WaPi.io. Hubungi penyedia.';
    default:
      return `WaPi.io menolak permintaan (HTTP ${status}).`;
  }
}

/**
 * Mengirim kode OTP lewat WaPi.io.
 *
 * Kontraknya: `POST {WAPI_BASE_URL}/otp/send` dengan
 * `{ phone, template_id, code, ttl_minutes }` dan `Authorization: Bearer <kunci>`.
 * Nomor harus dalam format internasional tanpa tanda plus (`62812...`).
 */
async function kirimOtpLewatWapi({
  phoneNumber,
  otpCode,
}: {
  phoneNumber: string;
  otpCode: string;
}): Promise<boolean> {
  const apiKey = process.env.WAPI_API_KEY?.trim();
  if (!apiKey) {
    logger.warn(
      { phoneNumber },
      '[WA OTP] WAPI_API_KEY belum disetel di .env. Pengiriman OTP lewat WaPi.io dilewati.',
    );
    return false;
  }

  const dasar = (
    process.env.WAPI_BASE_URL?.trim() || 'https://wapi.sixsevensixseven.my.id/api/v1'
  ).replace(/\/+$/, '');
  const templateId = process.env.WAPI_TEMPLATE_ID?.trim() || 'otp_standard';
  const ttlMenit = Number(process.env.WAPI_OTP_TTL_MINUTES ?? 5);
  const target = toInternationalPhone(phoneNumber);

  try {
    logger.info({ target, templateId }, '[WA OTP] Mengirim kode lewat WaPi.io...');

    const response = await fetch(`${dasar}/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        phone: target,
        template_id: templateId,
        code: otpCode,
        ttl_minutes: Number.isFinite(ttlMenit) && ttlMenit > 0 ? ttlMenit : 5,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = (await response.json().catch(() => null)) as {
      code?: string;
      detail?: string;
      status?: string;
    } | null;

    if (!response.ok) {
      logger.error(
        {
          status: response.status,
          kode: data?.code,
          detail: data?.detail,
          target,
        },
        `[WA OTP] ${jelaskanGalatWapi(response.status, data?.code)}`,
      );
      return false;
    }

    logger.info({ target, status: data?.status }, '[WA OTP] Kode terkirim lewat WaPi.io.');
    return true;
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : err, target },
      '[WA OTP] Gagal memanggil WaPi.io.',
    );
    return false;
  }
}

export const whatsappOtpService = {
  /** Mengirim kode verifikasi lewat penyedia yang sedang aktif. */
  async sendOtp({ phoneNumber, otpCode, fullName }: SendWhatsAppOtpOptions): Promise<boolean> {
    const penyedia = penyediaOtp();

    if (penyedia === 'wapi') {
      return kirimOtpLewatWapi({ phoneNumber, otpCode });
    }

    if (penyedia === 'off') {
      logger.warn(
        { phoneNumber },
        '[WA OTP] Tidak ada penyedia WhatsApp yang dikonfigurasi (WAPI_API_KEY / WA_GATEWAY_URL kosong).',
      );
      return false;
    }

    const nama = fullName?.trim() || 'Pelanggan MobilJuragan';

    const pesan = [
      `Halo *${nama}*,`,
      '',
      'Berikut adalah kode verifikasi (OTP) untuk masuk ke aplikasi *MobilJuragan*:',
      '',
      `👉 *${otpCode}*`,
      '',
      'Kode ini hanya berlaku selama *5 menit*.',
      '⚠️ _Demi keamanan, JANGAN berikan kode ini kepada siapa pun, termasuk pihak yang mengaku sebagai staf MobilJuragan._',
      '',
      'Salam,',
      'CV. Mobil Juragan Express Transport Merauke',
    ].join('\n');

    return kirimPesanWhatsApp({ phoneNumber, pesan, jenis: 'OTP' });
  },

  /**
   * Memberi tahu pemilik akun bahwa identitasnya berubah.
   *
   * Dikirim ke nomor **lama** dan (bila berbeda) nomor **baru**, supaya pemilik
   * nomor lama tetap tahu kalau akunnya dipakai orang lain.
   *
   * Selalu lewat gateway GOWA: endpoint OTP WaPi.io hanya mengirim template,
   * bukan teks yang kita susun sendiri.
   */
  async sendIdentityChanged({
    phoneNumber,
    nama,
    perubahan,
    waktu,
  }: {
    phoneNumber: string;
    nama: string;
    perubahan: string;
    waktu: Date;
  }): Promise<boolean> {
    const pesan = [
      `Halo *${nama}*,`,
      '',
      'Kami mencatat perubahan data pada akun *MobilJuragan* Anda:',
      '',
      `• ${perubahan}`,
      `• Waktu: ${waktu.toLocaleString('id-ID', { timeZone: 'Asia/Jayapura' })} WIT`,
      '',
      '⚠️ *Jika Anda tidak melakukan perubahan ini*, segera hubungi admin MobilJuragan. Akun Anda mungkin sedang diakses orang lain.',
      '',
      'Salam,',
      'CV. Mobil Juragan Express Transport Merauke',
    ].join('\n');

    return kirimPesanWhatsApp({ phoneNumber, pesan, jenis: 'NOTIFIKASI' });
  },

  /** Pesan bebas untuk keperluan lain (mis. pemberitahuan pemulihan kata sandi). */
  async sendMessage({
    phoneNumber,
    pesan,
  }: {
    phoneNumber: string;
    pesan: string;
  }): Promise<boolean> {
    return kirimPesanWhatsApp({ phoneNumber, pesan, jenis: 'NOTIFIKASI' });
  },
};
