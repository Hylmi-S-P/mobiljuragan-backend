import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../generated/prisma/client.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mobiljuragan-dev-secret-key-change-in-production';
const OTP_SALT = process.env.OTP_SALT || 'mobiljuragan-otp-salt-key';

export interface AuthTokenPayload {
  userId: string;
  phoneNumber: string;
  role: UserRole;
}

/**
 * Menghasilkan 6-digit OTP acak.
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Menghasilkan hash OTP menggunakan SHA-256 + salt.
 * Plaintext OTP tidak boleh disimpan di database!
 */
export function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', OTP_SALT).update(otp).digest('hex');
}

/**
 * Memverifikasi kecocokan OTP dengan hash yang tersimpan.
 */
export function verifyOtpHash(otp: string, storedHash: string): boolean {
  const computedHash = hashOtp(otp);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
}

/**
 * Hash password untuk staf/admin menggunakan bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verifikasi password staf/admin.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Membuat token JWT autentikasi.
 */
export function signAuthToken(payload: AuthTokenPayload, expiresIn: string | number = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

/**
 * Memverifikasi dan mendekode token JWT.
 */
export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
