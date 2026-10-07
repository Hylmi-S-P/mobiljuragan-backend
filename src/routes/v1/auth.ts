import { Router } from 'express';
import { z } from 'zod';
import { authController } from '../../controller/authController.js';
import { validateBody } from '../../middleware/validate.js';

/**
 * Customer Auth: /api/v1/auth/*
 */
export const authRouter: Router = Router();

const indonesianPhoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;

const otpRequestSchema = z.object({
  phoneNumber: z.string().regex(indonesianPhoneRegex, 'Format nomor telepon tidak valid (contoh: 081234567890).'),
  fullName: z.string().min(2, 'Nama minimal 2 karakter.').max(100).optional(),
  purpose: z.string().default('CUSTOMER_LOGIN'),
});

const otpVerifySchema = z.object({
  phoneNumber: z.string().regex(indonesianPhoneRegex, 'Format nomor telepon tidak valid.'),
  otp: z.string().length(6, 'Kode OTP harus berupa 6 digit angka.').regex(/^\d+$/, 'Kode OTP harus berupa angka.'),
  purpose: z.string().default('CUSTOMER_LOGIN'),
});

// Meminta kode OTP untuk login/registrasi customer.
authRouter.post('/otp/request', validateBody(otpRequestSchema), authController.requestOtp);

// Memverifikasi kode OTP customer.
authRouter.post('/otp/verify', validateBody(otpVerifySchema), authController.verifyOtp);