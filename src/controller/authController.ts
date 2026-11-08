import type { NextFunction, Request, Response } from 'express';
import {
  authModel,
  OTP_BLOCK_MINUTES,
  OTP_TTL_MINUTES,
} from '../model/authModel.js';
import {
  generateOtp,
  hashOtp,
  hashPasswordPelanggan,
  signAuthToken,
  verifyOtpHash,
} from '../lib/auth.js';
import { AppError, sendSuccess } from '../lib/response.js';
import { normalizePhoneNumber } from '../lib/phone.js';
import { logger } from '../logger.js';
import { whatsappOtpService } from '../services/whatsappOtp.service.js';
import { periksaKataSandi, ringkasanKegagalan } from '../lib/passwordPolicy.js';

/**
 * Autentikasi pelanggan: OTP dan kata sandi.
 *
 * Prinsip yang dijaga seluruh berkas ini:
 *
 * 1. **Verifikasi dulu, tulis kemudian.** Permintaan OTP tidak menyentuh tabel
 *    `users` sama sekali. Akun baru hanya lahir di `verifyRegisterOtp` setelah
 *    kode terbukti.
 * 2. **Nama tidak pernah ditulis dari jalur autentikasi.** Dulu `requestOtp`
 *    mengganti `fullName` milik nomor yang sudah terdaftar, sehingga siapa pun
 *    bisa mengambil alih akun orang lain hanya dengan mengetik nama berbeda.
 * 3. **Gagal terang, bukan berhasil palsu.** Tidak ada kode ajaib yang diterima
 *    tanpa verifikasi di server.
 *
 * Latar lengkap: `docs/analisis-akun-tertimpa-otp.md`.
 */

/** Tujuan OTP yang dikenali. Nilai lain ditolak, bukan diteruskan apa adanya. */
const TUJUAN = {
  LOGIN: 'CUSTOMER_LOGIN',
  REGISTER: 'CUSTOMER_REGISTER',
} as const;

type Tujuan = (typeof TUJUAN)[keyof typeof TUJUAN];

/**
 * Apakah kode ajaib pengembangan boleh dipakai.
 *
 * Syaratnya dua-duanya: bukan produksi, dan saklar eksplisit dinyalakan.
 * Versi sebelumnya hanya memeriksa `NODE_ENV !== 'production'`, sehingga satu
 * salah-setel variabel lingkungan di server cukup untuk membuka pintu masuk
 * tanpa OTP.
 */
function kodePengembanganDiizinkan(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_DEV_OTP_BYPASS === 'true'
  );
}

/** Kode yang hanya berlaku saat `kodePengembanganDiizinkan()`. */
const KODE_PENGEMBANGAN = '123456';

function kirimToken(
  res: Response,
  user: {
    id: string;
    phoneNumber: string;
    role: string;
    fullName: string;
    tokenVersion?: number;
    phoneVerifiedAt?: Date | null;
    passwordUpdatedAt?: Date | null;
  },
  statusCode = 200,
): void {
  const token = signAuthToken({
    userId: user.id,
    phoneNumber: user.phoneNumber,
    role: user.role as never,
    /* `ver` membuat token ini gugur begitu tokenVersion akun dinaikkan. */
    ver: user.tokenVersion ?? 0,
  });

  sendSuccess(
    res,
    {
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        /* Status kredensial ikut dikirim supaya aplikasi tahu apakah menu
           profil harus menawarkan "buat" atau "ganti" kata sandi. */
        phoneVerifiedAt: user.phoneVerifiedAt ?? null,
        passwordUpdatedAt: user.passwordUpdatedAt ?? null,
      },
    },
    statusCode,
  );
}

/** Menolak lebih awal bila nomor sedang diblokir karena percobaan gagal. */
async function pastikanTidakDiblokir(phoneNumber: string): Promise<void> {
  const guard = await authModel.ambilGuard(phoneNumber);
  if (guard?.blockedUntil && guard.blockedUntil.getTime() > Date.now()) {
    const sisaMenit = Math.ceil((guard.blockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(
      'ACCOUNT_LOCKED',
      `Terlalu banyak percobaan untuk nomor ini. Coba lagi dalam ${sisaMenit} menit.`,
      429,
      { retryAfterMinutes: sisaMenit },
    );
  }
}

/**
 * Mencocokkan kode dan menangani kegagalannya secara terpusat.
 *
 * Hitungan gagal disimpan per nomor, bukan per baris OTP: meminta kode baru
 * tidak boleh mengembalikan jatah tebakan ke nol.
 */
async function cocokkanKode(
  phoneNumber: string,
  kode: string,
  otpHash: string,
  idKode: string,
): Promise<void> {
  const cocok =
    verifyOtpHash(kode, otpHash) ||
    (kodePengembanganDiizinkan() && kode === KODE_PENGEMBANGAN);

  if (cocok) {
    await authModel.tandaiKodeTerpakai(idKode);
    return;
  }

  await authModel.tambahPercobaanKode(idKode);
  const hasil = await authModel.catatKegagalanVerifikasi(phoneNumber, new Date());

  if (hasil.terkunciSampai) {
    throw new AppError(
      'ACCOUNT_LOCKED',
      `Terlalu banyak kode yang salah. Nomor ini dikunci ${OTP_BLOCK_MINUTES} menit.`,
      429,
      { retryAfterMinutes: OTP_BLOCK_MINUTES },
    );
  }

  throw new AppError(
    'OTP_INVALID',
    `Kode verifikasi salah. Sisa kesempatan: ${hasil.sisaPercobaan} kali.`,
    400,
    { remainingAttempts: hasil.sisaPercobaan },
  );
}

export const authController = {
  /**
   * Meminta kode OTP.
   *
   * Tidak membuat atau mengubah baris `users`. Untuk `intent=register`, nomor
   * yang sudah terdaftar ditolak; untuk `intent=login`, nomor yang belum
   * terdaftar dijawab dengan bentuk sukses yang sama agar daftar pelanggan tidak
   * bisa dipetakan dari luar.
   */
  async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone, intent } = req.body as {
        phoneNumber: string;
        intent: 'login' | 'register';
      };
      const phoneNumber = normalizePhoneNumber(rawPhone);
      const inginDaftar = intent === 'register';
      const purpose = inginDaftar ? TUJUAN.REGISTER : TUJUAN.LOGIN;

      await pastikanTidakDiblokir(phoneNumber);

      const user = await authModel.findUserByPhoneNumber(phoneNumber);

      if (inginDaftar && user) {
        throw new AppError(
          'PHONE_ALREADY_REGISTERED',
          'Nomor ini sudah terdaftar. Silakan masuk memakai nomor tersebut.',
          409,
        );
      }

      /* Nomor tak dikenal pada alur masuk: jawab seperti biasa, tanpa membuat
         kode. Pemanggil tidak bisa membedakan nomor terdaftar dari yang tidak. */
      if (!inginDaftar && !user) {
        logger.info({ phoneNumber }, '[OTP REQUEST] Nomor belum terdaftar, permintaan diabaikan.');
        sendSuccess(
          res,
          {
            phoneNumber,
            expiresInSeconds: OTP_TTL_MINUTES * 60,
            resendCooldownSeconds: 60,
          },
          200,
        );
        return;
      }

      const izin = await authModel.catatPengiriman(phoneNumber, new Date());
      if (!izin.boleh) {
        const pesan =
          izin.alasan === 'KUOTA'
            ? 'Terlalu banyak permintaan kode untuk nomor ini. Coba lagi nanti.'
            : `Mohon tunggu ${izin.tungguDetik ?? 60} detik sebelum meminta kode lagi.`;

        throw new AppError(
          izin.alasan === 'KUOTA' ? 'OTP_RATE_LIMITED' : 'OTP_COOLDOWN',
          pesan,
          429,
          izin.tungguDetik ? { retryAfterSeconds: izin.tungguDetik } : {},
        );
      }

      const kode = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

      await authModel.simpanKodeBaru({
        userId: user?.id ?? null,
        phoneNumber,
        otpHash: hashOtp(kode),
        purpose,
        expiresAt,
      });

      logger.info({ phoneNumber, purpose }, '[OTP REQUEST] Kode verifikasi dibuat.');

      whatsappOtpService
        .sendOtp({
          phoneNumber,
          otpCode: kode,
          fullName: user?.fullName ?? 'Pelanggan MobilJuragan',
        })
        .catch((err) => {
          logger.error({ err, phoneNumber }, '[OTP REQUEST] Gagal mengirim WhatsApp OTP');
        });

      sendSuccess(
        res,
        {
          phoneNumber,
          expiresInSeconds: OTP_TTL_MINUTES * 60,
          resendCooldownSeconds: 60,
          /* Hanya untuk lingkungan pengembangan yang menyalakan saklar eksplisit.
             Tidak pernah dikirim di produksi. */
          ...(kodePengembanganDiizinkan() ? { devMockOtp: kode } : {}),
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verifikasi OTP untuk **masuk**.
   *
   * Tidak menyentuh `fullName`. Nomor yang belum terdaftar tidak pernah sampai
   * ke sini karena kodenya tidak pernah dibuat.
   */
  async verifyLoginOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone, otp } = req.body;
      const phoneNumber = normalizePhoneNumber(rawPhone);

      await pastikanTidakDiblokir(phoneNumber);

      const kodeAktif = await authModel.findKodeAktif(phoneNumber, TUJUAN.LOGIN);
      if (!kodeAktif) {
        throw new AppError(
          'OTP_NOT_FOUND',
          'Tidak ada kode yang aktif untuk nomor ini. Silakan minta kode baru.',
          400,
        );
      }

      if (kodeAktif.expiresAt.getTime() < Date.now()) {
        await authModel.cabutSemuaKode(phoneNumber);
        throw new AppError(
          'OTP_EXPIRED',
          'Kode verifikasi sudah kedaluwarsa. Silakan minta kode baru.',
          400,
        );
      }

      await cocokkanKode(phoneNumber, otp, kodeAktif.otpHash, kodeAktif.id);

      const user = await authModel.findUserByPhoneNumber(phoneNumber);
      if (!user) {
        throw new AppError('INVALID_CREDENTIALS', 'Nomor atau kode tidak sesuai.', 401);
      }

      if (!user.isActive) {
        throw new AppError(
          'ACCOUNT_INACTIVE',
          'Akun ini sedang tidak aktif. Hubungi admin untuk bantuan.',
          403,
        );
      }
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const sisaMenit = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
        throw new AppError(
          'ACCOUNT_LOCKED',
          `Akun ini terkunci sementara. Coba lagi dalam ${sisaMenit} menit.`,
          429,
          { retryAfterMinutes: sisaMenit },
        );
      }

      await authModel.cabutSemuaKode(phoneNumber);
      await authModel.resetGuard(phoneNumber);
      await authModel.catatLoginBerhasil(user.id);

      logger.info(
        { userId: user.id, phoneNumber },
        '[OTP VERIFY] Pelanggan masuk lewat kode verifikasi.',
      );

      kirimToken(res, user);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verifikasi OTP **pendaftaran**: satu-satunya tempat baris pelanggan dibuat.
   *
   * Nama dan kata sandi baru dikirim di langkah ini, setelah kode terbukti,
   * sehingga tidak ada identitas yang tersimpan sebelum nomornya terverifikasi.
   */
  async verifyRegisterOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone, otp, fullName, password } = req.body;
      const phoneNumber = normalizePhoneNumber(rawPhone);

      await pastikanTidakDiblokir(phoneNumber);

      const kodeAktif = await authModel.findKodeAktif(phoneNumber, TUJUAN.REGISTER);
      if (!kodeAktif) {
        throw new AppError(
          'OTP_NOT_FOUND',
          'Tidak ada kode pendaftaran yang aktif untuk nomor ini. Silakan minta kode baru.',
          400,
        );
      }

      if (kodeAktif.expiresAt.getTime() < Date.now()) {
        await authModel.cabutSemuaKode(phoneNumber);
        throw new AppError(
          'OTP_EXPIRED',
          'Kode verifikasi sudah kedaluwarsa. Silakan minta kode baru.',
          400,
        );
      }

      await cocokkanKode(phoneNumber, otp, kodeAktif.otpHash, kodeAktif.id);

      /* Kepemilikan nomor sudah terbukti. Mulai titik ini barulah data pendaftaran
         boleh disimpan. */
      const sudahAda = await authModel.findUserByPhoneNumber(phoneNumber);
      if (sudahAda) {
        throw new AppError(
          'PHONE_ALREADY_REGISTERED',
          'Nomor ini sudah terdaftar. Silakan masuk memakai nomor tersebut.',
          409,
        );
      }

      const pelanggaran = periksaKataSandi(password, { fullName, phoneNumber });
      if (pelanggaran.length > 0) {
        const ringkasan = ringkasanKegagalan(pelanggaran);
        throw new AppError('PASSWORD_POLICY', ringkasan.message, 400, {
          rules: ringkasan.rules,
        });
      }

      const nama = String(fullName).trim();
      if (nama.length < 3) {
        throw new AppError('INVALID_INPUT', 'Nama lengkap minimal 3 karakter.', 400);
      }

      const user = await authModel.createVerifiedCustomer({
        phoneNumber,
        fullName: nama,
        passwordHash: await hashPasswordPelanggan(password),
        phoneVerifiedAt: new Date(),
      });

      await authModel.cabutSemuaKode(phoneNumber);
      await authModel.resetGuard(phoneNumber);

      logger.info({ userId: user.id, phoneNumber }, '[OTP VERIFY] Pelanggan baru terdaftar.');

      kirimToken(res, user, 201);
    } catch (error) {
      next(error);
    }
  },

};

export type { Tujuan };
