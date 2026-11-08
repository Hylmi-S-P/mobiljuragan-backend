import { toInternationalPhone } from '../lib/phone.js';
import { logger } from '../logger.js';

/**
 * Pengiriman pesan WhatsApp lewat gateway GOWA
 * (aldinokemal/go-whatsapp-web-multidevice).
 *
 * Dua kebutuhan memakai berkas ini:
 * 1. kode OTP saat masuk/daftar/pemulihan kata sandi;
 * 2. pemberitahuan ke pemilik akun saat identitasnya berubah.
 *
 * Yang kedua bukan pelengkap. Kalau nama atau nomor seseorang diganti tanpa
 * sepengetahuannya, pesan itulah satu-satunya cara ia tahu dan bisa melapor.
 */

export interface SendWhatsAppOtpOptions {
  phoneNumber: string;
  otpCode: string;
  fullName?: string;
}

type JenisPesan = 'OTP' | 'NOTIFIKASI';

interface KonfigurasiGateway {
  endpoint: string;
  deviceId: string;
  headers: Record<string, string>;
}

/**
 * Menyiapkan konfigurasi gateway, atau null bila belum disetel.
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

/** Mengirim satu pesan teks ke satu nomor. */
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

export const whatsappOtpService = {
  /** Mengirim kode verifikasi. */
  async sendOtp({ phoneNumber, otpCode, fullName }: SendWhatsAppOtpOptions): Promise<boolean> {
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
