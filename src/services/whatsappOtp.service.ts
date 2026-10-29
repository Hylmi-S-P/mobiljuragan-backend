import { toInternationalPhone } from '../lib/phone.js';
import { logger } from '../logger.js';

export interface SendWhatsAppOtpOptions {
  phoneNumber: string;
  otpCode: string;
  fullName?: string;
}

export const whatsappOtpService = {
  /**
   * Mengirim kode OTP ke WhatsApp penerima melalui REST API GOWA
   * (aldinokemal/go-whatsapp-web-multidevice).
   */
  async sendOtp({ phoneNumber, otpCode, fullName }: SendWhatsAppOtpOptions): Promise<boolean> {
    const gatewayUrl = process.env.WA_GATEWAY_URL?.trim();
    const deviceId =
      process.env.WA_GATEWAY_DEVICE_ID?.trim() || '6729527b-ecb0-4e58-87a4-2d954c682c6c';
    const username = process.env.WA_GATEWAY_USER?.trim();
    const password = process.env.WA_GATEWAY_PASSWORD?.trim();

    if (!gatewayUrl) {
      logger.warn(
        { phoneNumber },
        '[WA OTP] WA_GATEWAY_URL belum disetel di .env. Pengiriman pesan WhatsApp dilewati.',
      );
      return false;
    }

    const internationalPhone = toInternationalPhone(phoneNumber);
    const recipientName = fullName?.trim() || 'Pelanggan MobilJuragan';

    const message = [
      `Halo *${recipientName}*,`,
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

    const cleanBaseUrl = gatewayUrl.replace(/\/+$/, '');
    const endpoint = `${cleanBaseUrl}/send/message`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
      };

      if (username && password) {
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }

      logger.info(
        { target: internationalPhone, deviceId, endpoint },
        '[WA OTP] Mengirim kode OTP via WhatsApp Gateway...',
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: internationalPhone,
          message,
        }),
        signal: AbortSignal.timeout(10000), // Timeout 10 detik
      });

      const responseData = (await response.json().catch(() => null)) as any;

      if (!response.ok) {
        logger.error(
          { status: response.status, responseData, target: internationalPhone },
          '[WA OTP] Gagal mengirim pesan WhatsApp dari gateway',
        );
        return false;
      }

      logger.info(
        { target: internationalPhone, responseData },
        '[WA OTP] Kode OTP berhasil terkirim via WhatsApp!',
      );
      return true;
    } catch (err: any) {
      logger.error(
        { error: err?.message || err, target: internationalPhone },
        '[WA OTP] Terjadi kesalahan saat memanggil WhatsApp Gateway',
      );
      return false;
    }
  },
};
